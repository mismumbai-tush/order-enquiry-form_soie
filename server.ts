import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import cookieSession from "cookie-session";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // OAuth Client Setup
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const REDIRECT_URI = `${process.env.APP_URL || "http://localhost:3000"}/auth/callback`;

  const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  app.use(cors());
  app.use(bodyParser.json());
  app.use(
    cookieSession({
      name: "session",
      keys: [process.env.SESSION_SECRET || "a-very-secret-key"],
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: true,
      sameSite: "none",
    })
  );

  // Auth Routes
  app.get("/api/auth/url", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/userinfo.email", "profile"],
      prompt: "select_account",
    });
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
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

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Auth callback error:", error);
      res.status(500).send("Authentication failed");
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

  // API Routes
  app.post("/api/submit-enquiry", async (req, res) => {
    const { dateOfEnquiry, description, customerName, email: manualEmail, articleNumber, quantity, enquiryType } = req.body;
    const session = req as any;
    const user = session.session?.user;

    // Use manual email if provided, otherwise use logged-in user's email, otherwise Anonymous
    const emailToLog = (manualEmail || user?.email || "Anonymous").trim();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || "1JP1tkeyW314TC5wn8yAQ504D745yx5XwgnY72TqSTDo";

    if (!process.env.GOOGLE_SHEET_ID) {
      console.warn("GOOGLE_SHEET_ID is not configured. Using default sheet.");
    }

    try {
      // 1. Initialize Google Auth for Sheets (using Service Account)
      const authKeyStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      if (!authKeyStr) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not configured.");
      }
      
      const credentials = JSON.parse(authKeyStr);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth });

      // 2. Map Email to Tab Name
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

      const mappedName = emailToNameMap[emailToLog.toLowerCase()] || emailToLog.replace(/[^a-zA-Z0-9]/g, "_");
      const tabName = mappedName;
      
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetExists = spreadsheet.data.sheets?.some(s => s.properties?.title === tabName);

      if (!sheetExists) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title: tabName }
                }
              }
            ]
          }
        });
        // Add header row for the new sheet
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${tabName}!A1:H1`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [["Date", "Email", "Description", "Customer Name", "Article Number", "Quantity", "Type", "Timestamp"]]
          }
        });
      }

      // 3. Append data to the specific tab
      const values = [
        [dateOfEnquiry, emailToLog, description, customerName, articleNumber, quantity, enquiryType, new Date().toISOString()]
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${tabName}!A:H`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values,
        },
      });

      res.json({ success: true, message: `Enquiry saved successfully in tab: ${tabName}` });
    } catch (error: any) {
      console.error("Error saving to Google Sheets:", error);
      
      let errorMessage = "Failed to save enquiry. Please try again later.";
      
      if (error.message?.includes("GOOGLE_SERVICE_ACCOUNT_KEY")) {
        errorMessage = "Server configuration error: Google Service Account Key is missing.";
      } else if (error.message?.includes("API has not been used") || error.message?.includes("disabled")) {
        errorMessage = "Google Sheets API is not enabled. Please enable it in the Google Cloud Console.";
      } else if (error.message?.includes("PERMISSION_DENIED") || error.status === 403) {
        errorMessage = "Permission denied. Make sure the Service Account email is added as an Editor to the Google Sheet.";
      } else if (error.message?.includes("NOT_FOUND") || error.status === 404) {
        errorMessage = "Google Sheet not found. Please check the GOOGLE_SHEET_ID.";
      }

      res.status(500).json({ 
        success: false, 
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
