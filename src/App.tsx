import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  User, 
  FileText, 
  Hash, 
  Layers, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  Mail,
  Loader2,
  LogOut,
  LogIn,
  CheckSquare,
  Square
} from 'lucide-react';

interface User {
  email: string;
  name: string;
  picture: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    dateOfEnquiry: new Date().toISOString().split('T')[0],
    description: '',
    customerName: '',
    articleNumber: '',
    quantity: '',
    email: '',
    enquiryType: ''
  });

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    checkAuth();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        checkAuth();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setUser(data.user);
      if (data.user) {
        setFormData(prev => ({ 
          ...prev, 
          email: data.user.email
        }));
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch('/api/auth/url');
      const { url } = await res.json();
      window.open(url, 'google_oauth', 'width=500,height=600');
    } catch (err) {
      console.error('Failed to get auth URL:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setFormData(prev => ({ ...prev, email: '' }));
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/submit-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message);
        // Clear form after success
        setFormData({
          dateOfEnquiry: new Date().toISOString().split('T')[0],
          description: '',
          customerName: '',
          articleNumber: '',
          quantity: '',
          email: user?.email || '',
          enquiryType: ''
        });
      } else {
        setStatus('error');
        setMessage(data.message || data.error || 'Something went wrong');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Failed to connect to the server.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Toggle behavior for enquiryType
    if (name === 'enquiryType') {
      setFormData(prev => ({ 
        ...prev, 
        enquiryType: prev.enquiryType === value ? '' : value 
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto"
      >
        {/* Header Image */}
        <div className="w-full h-56 rounded-t-xl overflow-hidden shadow-sm mb-0 border border-slate-200 border-b-0 relative group bg-pink-50">
          {/* High-quality, clean ladies apparel background (no people) */}
          <img 
            src="https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?q=80&w=2070&auto=format&fit=crop" 
            alt="Ladies Apparel Header" 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-pink-200 pointer-events-none">
            {!formData.recordEmail && <Layers className="w-12 h-12 opacity-20" />}
          </div>
        </div>

        {/* Header Card */}
        <div className="bg-white rounded-b-xl shadow-sm border-t-0 overflow-hidden mb-6 border border-slate-200 border-t-indigo-600 border-t-8">
          <div className="p-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Enquiry Form</h1>
            <div className="flex flex-col gap-4">
              <p className="text-slate-600">Please fill out the details below to submit your enquiry.</p>
            </div>
          </div>
        </div>

        {status === 'success' ? (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-12 rounded-xl shadow-sm text-center"
          >
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Submitted!</h2>
            <p className="text-slate-600 mb-8">{message}</p>
            <button 
              onClick={() => setStatus('idle')}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Submit Another Enquiry
            </button>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date of Enquiry */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <label className="flex items-center text-sm font-medium text-slate-700 mb-2">
                <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
                Date of Enquiry
              </label>
              <input
                type="date"
                name="dateOfEnquiry"
                required
                value={formData.dateOfEnquiry}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            {/* Email (Manual) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <label className="flex items-center text-sm font-medium text-slate-700 mb-2">
                <Mail className="w-4 h-4 mr-2 text-indigo-500" />
                Email Address
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="Enter your email address"
                value={formData.email}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            {/* Name of Customer */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <label className="flex items-center text-sm font-medium text-slate-700 mb-2">
                <User className="w-4 h-4 mr-2 text-indigo-500" />
                Name of Customer
              </label>
              <input
                type="text"
                name="customerName"
                required
                placeholder="Enter customer name"
                value={formData.customerName}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            {/* Article Number */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <label className="flex items-center text-sm font-medium text-slate-700 mb-2">
                <Hash className="w-4 h-4 mr-2 text-indigo-500" />
                Article Number
              </label>
              <input
                type="text"
                name="articleNumber"
                required
                placeholder="e.g. ART-1234"
                value={formData.articleNumber}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            {/* Quantity */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <label className="flex items-center text-sm font-medium text-slate-700 mb-2">
                <Layers className="w-4 h-4 mr-2 text-indigo-500" />
                Quantity
              </label>
              <input
                type="text"
                name="quantity"
                required
                placeholder="Enter quantity"
                value={formData.quantity}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            {/* Type of Enquiry */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <label className="flex items-center text-sm font-medium text-slate-700 mb-2">
                <FileText className="w-4 h-4 mr-2 text-indigo-500" />
                Type of Enquiry (Optional)
              </label>
              <div className="flex gap-3">
                {['New', 'Order'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleChange({ target: { name: 'enquiryType', value: type } } as any)}
                    className={`px-6 py-2 text-sm text-center rounded-lg border transition-all ${
                      formData.enquiryType === type 
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-600 font-medium' 
                        : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <label className="flex items-center text-sm font-medium text-slate-700 mb-2">
                <FileText className="w-4 h-4 mr-2 text-indigo-500" />
                Description
              </label>
              <textarea
                name="description"
                required
                rows={4}
                placeholder="Provide more details about the enquiry..."
                value={formData.description}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
              />
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {status === 'error' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center"
                >
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="text-sm">{message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <div className="flex justify-start">
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-10 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-base shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        <footer className="mt-12 text-center text-slate-400 text-sm">
          <p>&copy; 2026 Enquiry Management System. All rights reserved.</p>
        </footer>
      </motion.div>
    </div>
  );
}
