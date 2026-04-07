import express from "express";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import cookieSession from "cookie-session";

const app = express();

// OAuth Client Setup
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const REDIRECT_URI = `${APP_URL}/auth/callback`;

let oauth2Client: OAuth2Client | null = null;
if (CLIENT_ID && CLIENT_SECRET) {
  oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

app.use(cors());
app.use(bodyParser.json());
app.use(
  cookieSession({
    name: "session",
    keys: [process.env.SESSION_SECRET || "a-very-secret-key"],
    maxAge: 24 * 60 * 60 * 1000,
    secure: true,
    sameSite: "lax",
    proxy: true,
  })
);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    env: process.env.NODE_ENV,
    hasServiceKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    hasClientId: !!process.env.GOOGLE_CLIENT_ID
  });
});

// Auth Routes
app.get("/api/auth/url", (req, res) => {
  if (!oauth2Client) return res.status(500).json({ error: "OAuth not configured" });
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/userinfo.email", "profile"],
    prompt: "select_account",
  });
  res.json({ url });
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!oauth2Client) return res.status(500).send("OAuth not initialized");
  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const session = req as any;
    if (session.session) {
      session.session.user = {
        email: payload?.email,
        name: payload?.name,
        picture: payload?.picture,
      };
    }
    res.send(`<html><body><script>if(window.opener){window.opener.postMessage({type:'OAUTH_AUTH_SUCCESS'},'*');window.close();}else{window.location.href='/';}</script></body></html>`);
  } catch (error) {
    res.status(500).send("Auth failed");
  }
});

app.get("/api/auth/me", (req, res) => {
  const session = req as any;
  res.json({ user: session.session?.user || null });
});

app.post("/api/auth/logout", (req, res) => {
  const session = req as any;
  session.session = null;
  res.json({ success: true });
});

// Submit Enquiry
app.post("/api/submit-enquiry", async (req, res) => {
  const { dateOfEnquiry, description, customerName, email: manualEmail, articleNumber, quantity, enquiryType } = req.body;
  const session = req as any;
  const user = session.session?.user;
  const emailToLog = (manualEmail || user?.email || "Anonymous").trim();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID || "1JP1tkeyW314TC5wn8yAQ504D745yx5XwgnY72TqSTDo";

  try {
    const authKeyStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!authKeyStr) throw new Error("Key missing");
    const credentials = JSON.parse(authKeyStr);
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const sheets = google.sheets({ version: "v4", auth });

    const emailToNameMap: { [key: string]: string } = {
      "rohit.sethia@ginzalimited.com": "Rohit Sethia",
      "manoj.sethia@ginzalimited.com": "Manoj Sethia",
      "merch5.apparel@ginzalimited.com": "Export Team",
      "merch2.apparel@ginzalimited.com": "Export Team",
      "amrit.daga@ginzalimited.com": "Amrit Daga",
      "mohit.maloo@ginzalimited.com": "Mohit Maloo",
      "merch2.soie@ginzalimited.com": "Shubhod Pawar",
      "shakti.bhandari@ginzalimited.com": "Shakti Bhandari"
    };

    const tabName = emailToNameMap[emailToLog.toLowerCase()] || emailToLog.replace(/[^a-zA-Z0-9]/g, "_");
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets?.some(s => s.properties?.title === tabName);

    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1:G1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [["Timestamp", "Date", "Customer Name", "Article Number", "Quantity", "Type", "Description"]] }
      });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A:G`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[new Date().toLocaleString(), dateOfEnquiry, customerName, articleNumber, quantity, enquiryType, description]] },
    });

    res.json({ success: true, message: `Saved in tab: ${tabName}` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default app;
