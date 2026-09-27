import React, { useState, useEffect, useCallback } from 'react';
import { Event, Question, AdminStats, OptionLetter } from '../types/index.js';
import { api } from '../services/api.js';
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Tv,
  Trophy,
  Download,
  RotateCcw,
  Search,
  CheckCircle,
  XCircle,
  HelpCircle,
  Users,
  Clock,
  Sparkles,
  School,
  ExternalLink,
  Copy,
  Check,
  BarChart3,
  Layers,
  FileQuestion,
  FileSpreadsheet,
  Lock,
  LogOut,
} from 'lucide-react';
import { googleSignIn, logout as googleSignOut } from '../services/googleAuth.js';
import { GoogleSheetsClient } from '../services/googleSheetsClient.js';

interface AdminPanelProps {
  onOpenProjector: (code: string) => void;
  onOpenLeaderboard: (code: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onOpenProjector,
  onOpenLeaderboard,
}) => {
  const [token, setToken] = useState<string>(() => localStorage.getItem('innovit_admin_token') || '');
  const [adminUser, setAdminUser] = useState<{ email: string; name: string; picture?: string } | null>(() => {
    try {
      const saved = localStorage.getItem('innovit_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [googleAccessToken, setGoogleAccessToken] = useState<string>(() => localStorage.getItem('innovit_google_token') || '');
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState<string>(() => {
    const saved = localStorage.getItem('innovit_sheet_id');
    if (saved && saved !== '18hg3xBzI57FUl7Cyoo93B0-ybM94pjdEl1C__jKVECg') {
      return saved;
    }
    return '1cvtA3tIAhoT2WdUX0HqkeWW7h9g26GD7BUcvZjLoFKk';
  });
  const [sheetsConfigured, setSheetsConfigured] = useState<boolean>(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>('');
  const [isConnectingSheets, setIsConnectingSheets] = useState(false);
  const [showPasskeyInput, setShowPasskeyInput] = useState(false);

  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Tabs: 'overview' | 'events' | 'questions' | 'participants' | 'sheets'
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'questions' | 'participants' | 'sheets'>('overview');

  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedEventCode, setSelectedEventCode] = useState<string>('DEMO2026');
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [eventForm, setEventForm] = useState({
    event_name: '',
    college_name: '',
    event_code: '',
    description: '',
    duration_seconds: 300,
    leaderboard_enabled: true,
    is_active: true,
    question_ids: [] as string[],
  });

  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionForm, setQuestionForm] = useState({
    question: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A' as OptionLetter,
    explanation: '',
    topic: 'Machine Learning',
    difficulty: 'Medium' as 'Easy' | 'Medium' | 'Hard',
    is_active: true,
  });

  // Filters
  const [participantSearch, setParticipantSearch] = useState('');
  const [questionFilterTopic, setQuestionFilterTopic] = useState('All');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Login handler via Emergency Passkey
  const handleLogin = async (e?: React.FormEvent, customPass?: string) => {
    if (e) e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    const pass = (customPass !== undefined ? customPass : passwordInput).trim();
    if (!pass) {
      setLoginError('Please enter the admin passkey (default: innovit2026)');
      setIsLoggingIn(false);
      return;
    }
    try {
      const res = await api.admin.login(pass, spreadsheetIdInput.trim() || undefined);
      const tokenVal = typeof res === 'string' ? res : res.token;
      setToken(tokenVal);
      localStorage.setItem('innovit_admin_token', tokenVal);
      const user = res.adminUser || { email: 'innovit.admin@innovit.org', name: 'Innovit Admin' };
      setAdminUser(user);
      localStorage.setItem('innovit_admin_user', JSON.stringify(user));
      if (res.sheetsConfigured !== undefined) setSheetsConfigured(res.sheetsConfigured);
      if (res.spreadsheetUrl) setSpreadsheetUrl(res.spreadsheetUrl);
      setPasswordInput('');
      showNotification('Signed in successfully with Admin Passkey');
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Check password.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Login handler via Official Google Account (Recommended)
  const handleGoogleSignIn = async () => {
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const authResult = await googleSignIn();
      if (!authResult) throw new Error('Google Sign-In was cancelled or failed.');

      const loginRes = await api.admin.googleLogin(authResult.accessToken, spreadsheetIdInput.trim() || undefined);
      setToken(loginRes.token);
      localStorage.setItem('innovit_admin_token', loginRes.token);
      setAdminUser(loginRes.adminUser);
      localStorage.setItem('innovit_admin_user', JSON.stringify(loginRes.adminUser));
      setGoogleAccessToken(authResult.accessToken);
      localStorage.setItem('innovit_google_token', authResult.accessToken);
      setSheetsConfigured(loginRes.sheetsConfigured);
      if (loginRes.spreadsheetUrl) setSpreadsheetUrl(loginRes.spreadsheetUrl);

      showNotification(
        loginRes.rosterMessage ||
          `Signed in as ${loginRes.adminUser.name} (${loginRes.adminUser.email})`
      );
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
        setShowPasskeyInput(true);
        setPasswordInput('innovit2026');
        setLoginError(
          `Domain "${window.location.hostname}" is not yet authorized in Firebase. Add "${window.location.hostname}" in Firebase Console > Authentication > Settings > Authorized domains, OR click the button below to sign in immediately with the Admin Passkey!`
        );
      } else {
        setLoginError(err.message || 'Google Sign-In failed');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await googleSignOut();
    } catch {
      // ignore
    }
    setToken('');
    setAdminUser(null);
    setGoogleAccessToken('');
    localStorage.removeItem('innovit_admin_token');
    localStorage.removeItem('innovit_admin_user');
    localStorage.removeItem('innovit_google_token');
  };

  // Google Sheets Actions
  const handleConnectGoogleForSheets = async () => {
    setIsConnectingSheets(true);
    try {
      const authResult = await googleSignIn();
      if (!authResult) throw new Error('Google Sign-In was cancelled or failed.');

      setGoogleAccessToken(authResult.accessToken);
      localStorage.setItem('innovit_google_token', authResult.accessToken);
      if (authResult.user) {
        const u = {
          email: authResult.user.email || 'innovit.techies@gmail.com',
          name: authResult.user.displayName || 'Admin',
        };
        setAdminUser(u);
        localStorage.setItem('innovit_admin_user', JSON.stringify(u));
      }

      const sId = spreadsheetIdInput.trim();
      setSheetsConfigured(true);
      if (sId) {
        setSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${sId}/edit`);
        localStorage.setItem('innovit_sheet_id', sId);
      }

      showNotification('Google Account authorized successfully! Live Sheets access enabled.');

      if (sId) {
        try {
          await GoogleSheetsClient.ensureTabsAndHeaders(sId, authResult.accessToken);
          if (token) {
            await api.admin.configureSheets(token, sId, authResult.accessToken);
          }
          showNotification('Google Account authorized and all 5 tabs verified in your sheet!');
        } catch (tabErr: any) {
          console.warn('Tab init on connect:', tabErr);
          showNotification(tabErr.message || 'Google authorized, but the sheet tabs could not be updated.', 'error');
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
        showNotification(
          `Domain "${window.location.hostname}" is not yet in Firebase Authorized domains. See instructions in the Google Sheets tab to whitelist it in 10 seconds!`,
          'error'
        );
      } else {
        showNotification(err.message || 'Failed to connect Google account', 'error');
      }
    } finally {
      setIsConnectingSheets(false);
    }
  };

  const handleInitSheets = async () => {
    if (!token) return;
    const sheetId = spreadsheetIdInput.trim();
    if (!sheetId) {
      showNotification('Please enter a Google Spreadsheet ID first.', 'error');
      return;
    }

    setIsConnectingSheets(true);
    try {
      // Always get a fresh token before Sheets operations to avoid expired token errors
      let freshToken = googleAccessToken;
      try {
        const { requestGoogleSheetsTokenViaGIS } = await import('../services/googleAuth.js');
        freshToken = await requestGoogleSheetsTokenViaGIS();
        setGoogleAccessToken(freshToken);
        localStorage.setItem('innovit_google_token', freshToken);
      } catch {
        if (!freshToken) {
          showNotification('Please authorize your Google Account first.', 'error');
          setIsConnectingSheets(false);
          return;
        }
      }

      const res = await GoogleSheetsClient.ensureTabsAndHeaders(sheetId, freshToken);
      setSheetsConfigured(true);
      setSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
      localStorage.setItem('innovit_sheet_id', sheetId);
      showNotification(res.message || 'All 5 tabs verified and initialized in your Google Sheet!');

      try {
        await api.admin.configureSheets(token, sheetId, freshToken);
      } catch (beErr) {
        console.warn('Backend configure error:', beErr);
      }
    } catch (err: any) {
      console.warn('Direct init error, falling back to backend:', err);
      try {
        const res = await api.admin.configureSheets(token, sheetId, googleAccessToken);
        setSheetsConfigured(res.isConfigured);
        if (res.spreadsheetUrl) setSpreadsheetUrl(res.spreadsheetUrl);
        showNotification('Google Sheets structure initialized! All 5 tabs ready.');
      } catch (backendErr: any) {
        showNotification(err.message || backendErr.message || 'Failed to initialize sheets', 'error');
      }
    } finally {
      setIsConnectingSheets(false);
    }
  };

  const handleSyncAllToSheets = async () => {
    if (!token) return;
    const sheetId = spreadsheetIdInput.trim();
    if (!sheetId) {
      showNotification('Please enter a Google Spreadsheet ID first.', 'error');
      return;
    }

    setIsConnectingSheets(true);
    try {
      // Always get a fresh token to avoid expired token errors
      let freshToken = googleAccessToken;
      try {
        const { requestGoogleSheetsTokenViaGIS } = await import('../services/googleAuth.js');
        freshToken = await requestGoogleSheetsTokenViaGIS();
        setGoogleAccessToken(freshToken);
        localStorage.setItem('innovit_google_token', freshToken);
      } catch {
        if (!freshToken) {
          showNotification('Please authorize your Google Account first.', 'error');
          setIsConnectingSheets(false);
          return;
        }
      }

      // Load every event's students so name, contact, college, branch, and score are written
      const eventList = events.length > 0 ? events : await api.admin.getEvents(token);
      const roster: any[] = [];
      for (const ev of eventList) {
        const rows = await api.admin.getAttempts(token, ev.event_code);
        for (const row of rows || []) {
          roster.push({ ...row, eventCode: row.eventCode || ev.event_code });
        }
      }
      if (selectedEventCode) {
        setAttempts(roster.filter((row) => row.eventCode === selectedEventCode));
      } else {
        setAttempts(roster);
      }

      const rawData = { events: eventList, questions, participants: roster, attempts: roster, answers: [] };
      const directRes = await GoogleSheetsClient.syncAllData(sheetId, freshToken, rawData);
      setSheetsConfigured(true);
      showNotification(directRes.message || 'Synced all records directly to Google Sheet!');

      try {
        await api.admin.syncAllSheets(token, freshToken, sheetId);
      } catch (bErr) {
        console.warn('Backend sync response:', bErr);
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to sync to Google Sheets', 'error');
    } finally {
      setIsConnectingSheets(false);
    }
  };

  // Load Admin Data
  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [s, evs, qs] = await Promise.all([
        api.admin.getStats(token),
        api.admin.getEvents(token),
        api.admin.getQuestions(token),
      ]);
      setStats(s);
      setEvents(evs);
      setQuestions(qs);

      if (evs.length > 0 && !selectedEventCode) {
        setSelectedEventCode(evs[0].event_code);
      }
    } catch (err: any) {
      if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
        handleLogout();
        setLoginError('Session expired. Please sign in again.');
      } else {
        showNotification(err.message || 'Error loading admin data', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [token, selectedEventCode]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, loadData]);

  // Load attempts for selected event
  const loadAttempts = useCallback(async () => {
    if (!token || !selectedEventCode) return;
    try {
      const data = await api.admin.getAttempts(token, selectedEventCode);
      setAttempts(data);
    } catch (err: any) {
      console.error('Failed to load attempts:', err);
    }
  }, [token, selectedEventCode]);

  useEffect(() => {
    if (token && activeTab === 'participants') {
      loadAttempts();
    }
  }, [token, activeTab, selectedEventCode, loadAttempts]);

  // Event modal openers
  const openCreateEventModal = () => {
    setEditingEvent(null);
    const defaultQIds = questions.slice(0, 5).map((q) => q.id);
    setEventForm({
      event_name: 'Innovit AI Challenge',
      college_name: 'Gyan Sagar College of Engineering',
      event_code: `GSCE${new Date().getFullYear()}`,
      description: 'How well do you really understand AI? 5 questions in 5 minutes.',
      duration_seconds: 300,
      leaderboard_enabled: true,
      is_active: true,
      question_ids: defaultQIds,
    });
    setShowEventModal(true);
  };

  const openEditEventModal = (ev: any) => {
    setEditingEvent(ev);
    setEventForm({
      event_name: ev.event_name,
      college_name: ev.college_name,
      event_code: ev.event_code,
      description: ev.description,
      duration_seconds: ev.duration_seconds,
      leaderboard_enabled: ev.leaderboard_enabled,
      is_active: ev.is_active,
      question_ids: ev.question_ids || [],
    });
    setShowEventModal(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.event_name || !eventForm.college_name || !eventForm.event_code) {
      showNotification('Please fill all required event fields', 'error');
      return;
    }

    try {
      if (editingEvent) {
        await api.admin.updateEvent(token, editingEvent.id, eventForm);
        showNotification(`Event '${eventForm.event_code}' updated successfully.`);
      } else {
        await api.admin.createEvent(token, eventForm);
        showNotification(`Event '${eventForm.event_code}' created successfully!`);
      }
      setShowEventModal(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save event', 'error');
    }
  };

  const handleDeleteEvent = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete event "${name}"?`)) return;
    try {
      await api.admin.deleteEvent(token, id);
      showNotification('Event deleted successfully.');
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete event', 'error');
    }
  };

  const handleToggleEventActive = async (ev: any) => {
    try {
      await api.admin.updateEvent(token, ev.id, { is_active: !ev.is_active });
      showNotification(`Event is now ${!ev.is_active ? 'Active' : 'Inactive'}.`);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to toggle event', 'error');
    }
  };

  // Question modal openers
  const openCreateQuestionModal = () => {
    setEditingQuestion(null);
    setQuestionForm({
      question: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
      explanation: '',
      topic: 'Machine Learning',
      difficulty: 'Medium',
      is_active: true,
    });
    setShowQuestionModal(true);
  };

  const openEditQuestionModal = (q: Question) => {
    setEditingQuestion(q);
    setQuestionForm({
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      topic: q.topic,
      difficulty: q.difficulty,
      is_active: q.is_active,
    });
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !questionForm.question.trim() ||
      !questionForm.option_a.trim() ||
      !questionForm.option_b.trim() ||
      !questionForm.option_c.trim() ||
      !questionForm.option_d.trim()
    ) {
      showNotification('Please fill in the question and all 4 options', 'error');
      return;
    }

    try {
      if (editingQuestion) {
        await api.admin.updateQuestion(token, editingQuestion.id, questionForm);
        showNotification('Question updated.');
      } else {
        await api.admin.createQuestion(token, questionForm);
        showNotification('New question created in question bank.');
      }
      setShowQuestionModal(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save question', 'error');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      await api.admin.deleteQuestion(token, id);
      showNotification('Question deleted.');
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete question', 'error');
    }
  };

  // Reset attempt for student
  const handleResetAttempt = async (attemptId: string, studentName: string) => {
    if (!confirm(`Reset quiz attempt for "${studentName}"? This will allow them to retake the quiz.`)) {
      return;
    }
    try {
      await api.admin.resetAttempt(token, attemptId);
      showNotification(`Attempt reset for ${studentName}. They can now retake the quiz.`);
      loadAttempts();
    } catch (err: any) {
      showNotification(err.message || 'Failed to reset attempt', 'error');
    }
  };

  // Copy link
  const copyQuizLink = (code: string) => {
    const url = `${window.location.origin}/quiz/${code}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  // CSV download
  const handleExportCSV = () => {
    if (!selectedEventCode) return;
    const url = api.admin.getExportUrl(token, selectedEventCode);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `innovit_quiz_${selectedEventCode.toLowerCase()}_results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Login view if unauthorized
  if (!token) {
    return (
      <div className="max-w-md mx-auto my-14 px-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Lock className="w-7 h-7 text-cyan-400" />
          </div>

          <h1 className="text-xl font-bold text-white mb-1">Innovit Admin Console</h1>
          <p className="text-xs text-slate-400 mb-6">
            Sign in with your authorized Google account to manage college events, question banks, and live Google Sheets sync.
          </p>

          {loginError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium text-left space-y-2.5">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-rose-200 leading-relaxed">{loginError}</p>
                </div>
              </div>
              {loginError.includes('authorized in Firebase') && (
                <div className="pt-2 border-t border-rose-500/20 text-[11px] text-rose-300 space-y-2">
                  <p className="text-slate-400 text-[11px]">
                    To enable 1-click Google Sign-In, add this domain to Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains:
                  </p>
                  <div className="bg-slate-950/80 p-2 rounded-lg font-mono text-cyan-300 text-[11px] select-all border border-slate-800 flex items-center justify-between">
                    <span>{typeof window !== 'undefined' ? window.location.hostname : 'quiz-fun-activity.vercel.app'}</span>
                    <span className="text-[10px] text-slate-500 uppercase font-sans font-bold">Copy</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLogin(undefined, 'innovit2026')}
                    className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>⚡ Instant Sign In with Admin Passkey (innovit2026)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Primary: Sign in with Google (Recommended) */}
          <div className="space-y-4">
            <div>
              <label className="block text-left text-[11px] font-semibold text-slate-400 mb-1">
                Google Spreadsheet ID (Optional, connect now or later)
              </label>
              <input
                type="text"
                value={spreadsheetIdInput}
                onChange={(e) => {
                  setSpreadsheetIdInput(e.target.value);
                  localStorage.setItem('innovit_sheet_id', e.target.value.trim());
                }}
                placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoggingIn}
              className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-sm font-bold flex items-center justify-center gap-3 transition-all shadow-md shadow-white/10 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{isLoggingIn ? 'Connecting to Google...' : 'Sign In with Google Account'}</span>
            </button>

            <div className="flex items-center gap-2 justify-center text-[11px] text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Authorized Admin: <strong className="text-slate-300">innovit.techies@gmail.com</strong></span>
            </div>
          </div>

          {/* Emergency Fallback Toggle */}
          <div className="mt-8 pt-5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowPasskeyInput(!showPasskeyInput)}
              className="text-xs text-slate-400 hover:text-slate-300 font-medium underline cursor-pointer"
            >
              {showPasskeyInput ? 'Close Emergency Passkey Login' : 'Or Use Emergency Admin Passkey'}
            </button>

            {showPasskeyInput && (
              <form onSubmit={handleLogin} className="space-y-3 mt-3 text-left">
                <div>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Admin Passkey (default: innovit2026)"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoggingIn ? 'Verifying Passkey...' : 'Sign In with Passkey'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Filtered Questions
  const filteredQuestions = questions.filter((q) => {
    if (questionFilterTopic === 'All') return true;
    return q.topic.toLowerCase() === questionFilterTopic.toLowerCase();
  });

  // Filtered Participants / Attempts
  const filteredAttempts = attempts.filter((att) => {
    if (!participantSearch.trim()) return true;
    const term = participantSearch.toLowerCase();
    return (
      att.fullName.toLowerCase().includes(term) ||
      att.identifier.toLowerCase().includes(term) ||
      att.collegeName.toLowerCase().includes(term) ||
      att.branch.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Top Admin Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Admin Console
            </span>
            <span className="text-xs text-slate-400 font-mono">v2.0 (Google Sheets & Google Ecosystem)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            College Event Manager
          </h1>
          {adminUser && (
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                {adminUser.picture ? (
                  <img src={adminUser.picture} alt="" className="w-3.5 h-3.5 rounded-full" />
                ) : (
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{adminUser.email}</span>
              </span>
              {sheetsConfigured ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Google Sheets Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px]">
                  Sheets Not Synced Yet
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={openCreateEventModal}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Event</span>
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* Floating feedback toast */}
      {feedbackMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2 text-sm font-semibold animate-bounce ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/95 border-rose-500/40 text-rose-200'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-1 sm:gap-2 mb-6 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'overview'
              ? 'bg-slate-800 text-cyan-400 border border-slate-700'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'events'
              ? 'bg-slate-800 text-cyan-400 border border-slate-700'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>College Events ({events.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'questions'
              ? 'bg-slate-800 text-cyan-400 border border-slate-700'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <FileQuestion className="w-4 h-4" />
          <span>Question Bank ({questions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('participants')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'participants'
              ? 'bg-slate-800 text-cyan-400 border border-slate-700'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Participants & Attempts</span>
        </button>

        <button
          onClick={() => setActiveTab('sheets')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'sheets'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Google Sheets Sync</span>
          {sheetsConfigured && (
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          )}
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase">Total Students</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                {stats.totalParticipants}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Unique registrations across events</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase">Completed</span>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
                {stats.completedAttempts}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Quizzes officially submitted</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase">Average Score</span>
                <BarChart3 className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-cyan-300 font-mono">
                {stats.averageScore} <span className="text-sm text-slate-500">/ 5</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Top score achieved: {stats.highestScore} / 5</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase">Active Events</span>
                <Layers className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                {stats.totalEvents}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">{stats.totalQuestions} questions in bank</p>
            </div>
          </div>

          {/* Quick College Event Cards in Overview */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                Active College Quizzes
              </h2>
              <button
                onClick={() => setActiveTab('events')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                View all &rarr;
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-extrabold text-cyan-400 px-2 py-0.5 bg-cyan-950 border border-cyan-800 rounded">
                        {ev.event_code}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          ev.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {ev.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white">{ev.event_name}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                      <School className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{ev.college_name}</span>
                    </p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-400">
                      <strong className="text-white font-mono">{ev.completedCount}</strong> completed &bull;{' '}
                      <strong className="text-white font-mono">{ev.avgScore}</strong> avg score
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onOpenProjector(ev.event_code)}
                        className="p-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Display Projector QR on Auditorium Screen"
                      >
                        <Tv className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Projector</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedEventCode(ev.event_code);
                          setActiveTab('participants');
                        }}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                        title="View Participants"
                      >
                        <Users className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EVENTS */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">All College Events</h2>
            <button
              onClick={openCreateEventModal}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Event</span>
            </button>
          </div>

          <div className="space-y-3">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-extrabold text-cyan-400 px-2 py-0.5 bg-cyan-950 border border-cyan-800 rounded">
                      {ev.event_code}
                    </span>
                    <button
                      onClick={() => handleToggleEventActive(ev)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase transition-colors cursor-pointer ${
                        ev.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {ev.is_active ? 'Active (Click to Pause)' : 'Inactive (Click to Activate)'}
                    </button>
                    <span className="text-xs text-slate-500">&bull;</span>
                    <span className="text-xs text-slate-400">
                      Duration: {Math.round(ev.duration_seconds / 60)} mins ({ev.duration_seconds}s)
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white">{ev.event_name}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <School className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{ev.college_name}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xl line-clamp-1">{ev.description}</p>
                </div>

                {/* Event Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                  <button
                    onClick={() => onOpenProjector(ev.event_code)}
                    className="px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    title="Fullscreen Projector QR"
                  >
                    <Tv className="w-3.5 h-3.5 text-violet-400" />
                    <span>Projector QR</span>
                  </button>

                  <button
                    onClick={() => onOpenLeaderboard(ev.event_code)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Leaderboard</span>
                  </button>

                  <button
                    onClick={() => copyQuizLink(ev.event_code)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    title="Copy Quiz URL for Students"
                  >
                    {copiedCode === ev.event_code ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span>{copiedCode === ev.event_code ? 'Copied!' : 'Copy Link'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedEventCode(ev.event_code);
                      setActiveTab('participants');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Scores ({ev.completedCount})</span>
                  </button>

                  <button
                    onClick={() => openEditEventModal(ev)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs cursor-pointer"
                    title="Edit Event"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteEvent(ev.id, ev.event_name)}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs cursor-pointer"
                    title="Delete Event"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: QUESTIONS BANK */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">AI Question Bank</h2>
              <p className="text-xs text-slate-400">
                Curated technical & humorous questions across AI topics.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={questionFilterTopic}
                onChange={(e) => setQuestionFilterTopic(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
              >
                <option value="All">All Topics</option>
                <option value="AI Basics">AI Basics</option>
                <option value="Machine Learning">Machine Learning</option>
                <option value="Generative AI">Generative AI</option>
                <option value="LLMs">LLMs</option>
                <option value="Computer Vision">Computer Vision</option>
                <option value="NLP">NLP</option>
                <option value="Real-world AI">Real-world AI</option>
              </select>

              <button
                onClick={openCreateQuestionModal}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Question</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-indigo-400 font-mono">
                      #{idx + 1} &bull; {q.topic}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        q.difficulty === 'Easy'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : q.difficulty === 'Medium'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {q.difficulty}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white mb-3">{q.question}</h3>

                  <div className="space-y-1.5 text-xs mb-3">
                    {(['A', 'B', 'C', 'D'] as OptionLetter[]).map((letter) => {
                      const optKey = `option_${letter.toLowerCase()}` as keyof Question;
                      const text = q[optKey] as string;
                      const isCorrect = q.correct_answer === letter;
                      return (
                        <div
                          key={letter}
                          className={`p-2 rounded-lg border text-xs flex items-center gap-2 ${
                            isCorrect
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-medium'
                              : 'bg-slate-950/60 border-slate-850 text-slate-300'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] ${
                              isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="truncate">{text}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-2.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-[11px] text-indigo-200">
                    <strong className="text-cyan-400">Explanation: </strong>
                    {q.explanation}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button
                    onClick={() => openEditQuestionModal(q)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PARTICIPANTS & ATTEMPTS */}
      {activeTab === 'participants' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Student Quiz Attempts</h2>
              <p className="text-xs text-slate-400">
                Live participant results with reset attempt control and CSV exporter.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Event Selector */}
              <select
                value={selectedEventCode}
                onChange={(e) => setSelectedEventCode(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-cyan-300 cursor-pointer"
              >
                {events.map((ev) => (
                  <option key={ev.event_code} value={ev.event_code}>
                    {ev.event_code} - {ev.college_name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Download CSV for College Coordinators"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              placeholder="Search by student name, email, mobile, or branch..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">Student</th>
                  <th className="px-4 py-3.5">Contact (Private)</th>
                  <th className="px-4 py-3.5">College & Branch</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-center">Score</th>
                  <th className="px-4 py-3.5 text-center">Time</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      No student attempts found for this event yet.
                    </td>
                  </tr>
                ) : (
                  filteredAttempts.map((att) => (
                    <tr key={att.attemptId} className="hover:bg-slate-850/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                        {att.fullName}
                      </td>

                      <td className="px-4 py-3 text-slate-300 font-mono text-xs whitespace-nowrap">
                        {att.identifier}
                      </td>

                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        <div className="text-white font-medium">{att.collegeName}</div>
                        <div className="text-[11px] text-slate-400">
                          {att.branch || 'General'} {att.year ? `(${att.year})` : ''}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            att.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : att.status === 'in_progress'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {att.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap font-mono font-bold">
                        {att.status === 'completed' ? (
                          <span className={att.score >= 4 ? 'text-emerald-400' : 'text-cyan-300'}>
                            {att.score} / {att.totalQuestions} ({att.percentage}%)
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center font-mono text-xs text-slate-300 whitespace-nowrap">
                        {att.durationTakenSeconds ? `${att.durationTakenSeconds}s` : '-'}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleResetAttempt(att.attemptId, att.fullName)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                          title="Reset student attempt so they can re-enter"
                        >
                          <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                          <span>Reset</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: GOOGLE SHEETS SYNC & ARCHITECTURE */}
      {activeTab === 'sheets' && (
        <div className="space-y-6">
          {/* Top Control Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </span>
                <h2 className="text-lg font-bold text-white">Google Sheets Integration</h2>
                {googleAccessToken ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Write Access Authorized
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    Google Authorization Required
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Google Sheets serves as your lightweight, zero-maintenance database. Events, questions, students, and quiz attempts are recorded directly in separate tabs.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {spreadsheetUrl && (
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Open Google Sheet</span>
                </a>
              )}

              <button
                type="button"
                onClick={handleSyncAllToSheets}
                disabled={isConnectingSheets}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isConnectingSheets ? 'animate-spin' : ''}`} />
                <span>{isConnectingSheets ? 'Syncing...' : 'Sync All Data Now'}</span>
              </button>
            </div>
          </div>

          {/* Authorization Notice if Logged in via Passkey */}
          {!googleAccessToken ? (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-3 shadow-lg">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-bold text-sm text-amber-300">
                    Step 1: Authorize Google Account to Enable Direct Sheet Writes
                  </p>
                  <p className="text-amber-200/90 leading-relaxed text-xs">
                    You signed in to the admin panel with the passkey (<code className="bg-amber-950 px-1.5 py-0.5 rounded text-amber-300 font-mono">innovit2026</code>). To create tabs and record quiz results into your Google Sheet (<code className="bg-amber-950 px-1.5 py-0.5 rounded text-cyan-300 font-mono">{spreadsheetIdInput}</code>), Google requires write permission from your Google account.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleConnectGoogleForSheets}
                  disabled={isConnectingSheets}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>{isConnectingSheets ? 'Connecting...' : 'Authorize Google Account (1-Click)'}</span>
                </button>
              </div>

              {/* Vercel Domain Whitelist Instructions */}
              <div className="mt-3 p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/20 text-[11px] space-y-1.5 text-slate-300">
                <p className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  If Google popup shows "unauthorized domain" on Vercel:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
                  <li>
                    Open Firebase Console: <a href="https://console.firebase.google.com/project/gen-lang-client-0149541750/authentication/settings" target="_blank" rel="noopener noreferrer" className="underline text-cyan-400 font-bold">Firebase Authorized Domains Settings</a>
                  </li>
                  <li>
                    Under <strong>Authorized domains</strong>, click <strong>Add domain</strong> and enter: <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300 font-mono">{typeof window !== 'undefined' ? window.location.hostname : 'quiz-fun-activity.vercel.app'}</code>
                  </li>
                  <li>Click <strong>Save</strong> and return here to click <strong>Authorize Google Account</strong>!</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold text-sm text-emerald-300">Google Account Connected & Authorized</p>
                  <p className="text-emerald-200/80 text-xs">Direct read/write access active. All 5 tabs can be created and synced directly.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConnectGoogleForSheets}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors"
              >
                Re-authorize Account
              </button>
            </div>
          )}

          {/* Spreadsheet ID Configuration Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <School className="w-4 h-4 text-indigo-400" />
                Connected Google Spreadsheet
              </h3>
              <p className="text-xs text-slate-400">
                Enter your Google Spreadsheet ID (from your sheet URL: <code className="text-cyan-300">https://docs.google.com/spreadsheets/d/&#123;SPREADSHEET_ID&#125;/edit</code>).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={spreadsheetIdInput}
                onChange={(e) => setSpreadsheetIdInput(e.target.value)}
                placeholder="e.g. 1cvtA3tIAhoT2WdUX0HqkeWW7h9g26GD7BUcvZjLoFKk"
                className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleInitSheets}
                disabled={isConnectingSheets || !spreadsheetIdInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isConnectingSheets ? 'Working...' : 'Verify & Ensure 5 Tabs'}</span>
              </button>
              <button
                type="button"
                onClick={handleSyncAllToSheets}
                disabled={isConnectingSheets || !spreadsheetIdInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-2"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isConnectingSheets ? 'animate-spin' : ''}`} />
                <span>Sync All Data Now</span>
              </button>
            </div>

            {spreadsheetUrl && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-300 truncate">
                  Sheet URL: <span className="font-mono text-cyan-400">{spreadsheetUrl}</span>
                </span>
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 font-bold shrink-0 flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Sheet in Google</span>
                </a>
              </div>
            )}
          </div>

          {/* Quick Step-by-Step Flow */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Direct Setup Checklist
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className={`p-3.5 rounded-xl border ${googleAccessToken ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-300'}`}>
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <span>1. Google Authorization</span>
                  {googleAccessToken && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[11px] text-slate-400">
                  {googleAccessToken ? 'Authorized! Your browser can write directly to Google Sheets.' : 'Click "Authorize Google Account" above to grant permission.'}
                </p>
              </div>

              <div className={`p-3.5 rounded-xl border ${sheetsConfigured ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-300'}`}>
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <span>2. Verify 5 Tabs</span>
                  {sheetsConfigured && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[11px] text-slate-400">
                  Click "Verify & Ensure 5 Tabs" to automatically create Events, Questions, Participants, Attempts, and Answers tabs.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border bg-slate-950 border-slate-800 text-slate-300">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <span>3. Live Quiz Record</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Whenever students submit the quiz, their scores and answers are instantly recorded in the sheet!
                </p>
              </div>
            </div>
          </div>

          {/* Simple, Human-Readable Google Sheets Structure */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Google Sheets Structure (Straightforward &amp; Clean &bull; Zero Raw UUIDs)
              </h3>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Organized for College Event Faculty &amp; Coordinators
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Sheet 1: Participants & Results */}
              <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-300 font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    1. Participants &amp; Results
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    Primary Tab &bull; 13 Columns
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mb-2 font-medium">
                  Complete student details with live quiz scores, percentage, and time taken in one clean row.
                </p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[10px] text-emerald-300 space-y-0.5">
                  <div className="text-white font-bold">#, Student Name, Email, Mobile</div>
                  <div>College, Branch, Year</div>
                  <div className="text-cyan-300 font-semibold">Score (e.g. 4 / 5), Percentage (80%)</div>
                  <div>Time Taken (e.g. 1m 45s), Status (Completed)</div>
                  <div className="text-slate-400">Submitted At, Event Code</div>
                </div>
              </div>

              {/* Sheet 2: Leaderboard */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-300 font-mono">2. Leaderboard</span>
                  <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">9 columns</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">Ranked leaderboard sorted by highest score &amp; fastest completion.</p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 font-mono text-[10px] text-amber-300 space-y-0.5">
                  <div>Rank (1, 2, 3...) &bull; Student Name</div>
                  <div>College &bull; Branch</div>
                  <div>Score &bull; Percentage &bull; Time Taken</div>
                  <div>Completed At &bull; Event Code</div>
                </div>
              </div>

              {/* Sheet 3: Questions */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-cyan-300 font-mono">3. Questions</span>
                  <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">9 columns</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">MCQ question bank with options, answer &amp; explanation.</p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 font-mono text-[10px] text-slate-300 space-y-0.5">
                  <div>#, Question</div>
                  <div>Option A, Option B, Option C, Option D</div>
                  <div className="text-cyan-300">Correct Option &bull; Explanation</div>
                  <div>Topic</div>
                </div>
              </div>

              {/* Sheet 4: Events */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-indigo-300 font-mono">4. Events</span>
                  <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">7 columns</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">College events summary and active time limits.</p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 font-mono text-[10px] text-slate-300 space-y-0.5">
                  <div>#, Event Code, Event Name</div>
                  <div>College Name, Duration, Status, Created At</div>
                </div>
              </div>

              {/* Sheet 5: Attempts (Clean) */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-violet-300 font-mono">5. Attempts</span>
                  <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">13 columns</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">Each submission with the student's contact details and score.</p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 font-mono text-[10px] text-slate-300 space-y-0.5">
                  <div>#, Student Name, Email, Mobile</div>
                  <div>College, Branch, Year</div>
                  <div>Score, Percentage, Time Taken, Status</div>
                  <div>Submitted At, Event Code</div>
                </div>
              </div>

              {/* Architecture Badge */}
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    High-Concurrency Architecture
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Students answer freely on their phones. Scores are atomic and synced cleanly to Google Sheets when they submit.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-indigo-900/50 flex items-center justify-between text-[10px] text-indigo-300">
                  <span>Batch write on submit</span>
                  <span>100% Server Authoritative</span>
                </div>
              </div>
            </div>
          </div>

          {/* Setup Walkthrough Card */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 text-xs text-slate-300 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              Deployment &amp; Setup Guide for Event Organizers
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="font-bold text-indigo-300 block mb-1">1. Google Spreadsheet</span>
                <p className="text-[11px] text-slate-400">
                  Create a blank spreadsheet in Google Drive. Copy the Spreadsheet ID from the URL and paste it in the box above, then click &ldquo;Verify &amp; Ensure 5 Tabs&rdquo;.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="font-bold text-cyan-300 block mb-1">2. Admin Google Sign-In</span>
                <p className="text-[11px] text-slate-400">
                  Admins log in using their authorized Google account (<code className="text-slate-200">innovit.techies@gmail.com</code>). Students never need a Google account.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="font-bold text-emerald-300 block mb-1">3. Event Execution</span>
                <p className="text-[11px] text-slate-400">
                  Open Projector QR mode on the auditorium screen. Students scan, register, complete the 5-minute quiz, and scores sync automatically into Google Sheets.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EVENT MODAL (Create / Edit) */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingEvent ? 'Edit College Event' : 'Create New College Event'}
            </h3>

            <form onSubmit={handleSaveEvent} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Event Name *</label>
                <input
                  type="text"
                  required
                  value={eventForm.event_name}
                  onChange={(e) => setEventForm({ ...eventForm, event_name: e.target.value })}
                  placeholder="e.g. Innovit AI Challenge 2026"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">College Name *</label>
                <input
                  type="text"
                  required
                  value={eventForm.college_name}
                  onChange={(e) => setEventForm({ ...eventForm, college_name: e.target.value })}
                  placeholder="e.g. Gyan Sagar College of Engineering"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Event Code * (Unique)
                  </label>
                  <input
                    type="text"
                    required
                    value={eventForm.event_code}
                    onChange={(e) => setEventForm({ ...eventForm, event_code: e.target.value.toUpperCase() })}
                    placeholder="e.g. GSCE2026"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Duration (Seconds)
                  </label>
                  <input
                    type="number"
                    min="60"
                    step="30"
                    value={eventForm.duration_seconds}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, duration_seconds: parseInt(e.target.value) || 300 })
                    }
                    placeholder="300 (5 mins)"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description / Tagline</label>
                <textarea
                  rows={2}
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  placeholder="How well do you really understand AI? 5 questions in 5 minutes."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              {/* Toggles */}
              <div className="flex gap-4 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventForm.is_active}
                    onChange={(e) => setEventForm({ ...eventForm, is_active: e.target.checked })}
                    className="rounded bg-slate-800 text-indigo-500"
                  />
                  <span>Active for Students</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventForm.leaderboard_enabled}
                    onChange={(e) => setEventForm({ ...eventForm, leaderboard_enabled: e.target.checked })}
                    className="rounded bg-slate-800 text-indigo-500"
                  />
                  <span>Public Leaderboard</span>
                </label>
              </div>

              {/* Question Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-300 font-semibold">
                    Select Questions ({eventForm.question_ids.length} selected)
                  </label>
                  <span className="text-[11px] text-slate-500">Pick 5 questions for standard quiz</span>
                </div>
                <div className="max-h-48 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  {questions.map((q) => {
                    const isSelected = eventForm.question_ids.includes(q.id);
                    return (
                      <label
                        key={q.id}
                        className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                          isSelected ? 'bg-indigo-950/40 text-white' : 'text-slate-400 hover:bg-slate-900'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEventForm({
                                ...eventForm,
                                question_ids: [...eventForm.question_ids, q.id],
                              });
                            } else {
                              setEventForm({
                                ...eventForm,
                                question_ids: eventForm.question_ids.filter((id) => id !== q.id),
                              });
                            }
                          }}
                          className="mt-0.5 rounded bg-slate-800 text-indigo-500"
                        />
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-cyan-400 block">{q.topic}</span>
                          <span className="truncate block">{q.question}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-750 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUESTION MODAL (Create / Edit) */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingQuestion ? 'Edit Question' : 'Add Question to Bank'}
            </h3>

            <form onSubmit={handleSaveQuestion} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Question Prompt *</label>
                <textarea
                  required
                  rows={3}
                  value={questionForm.question}
                  onChange={(e) => setQuestionForm({ ...questionForm, question: e.target.value })}
                  placeholder="e.g. If an AI model gets 99% accuracy during training but performs poorly on new data, what is happening?"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Topic</label>
                  <select
                    value={questionForm.topic}
                    onChange={(e) => setQuestionForm({ ...questionForm, topic: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white cursor-pointer"
                  >
                    <option value="AI Basics">AI Basics</option>
                    <option value="Machine Learning">Machine Learning</option>
                    <option value="Generative AI">Generative AI</option>
                    <option value="LLMs">LLMs</option>
                    <option value="Computer Vision">Computer Vision</option>
                    <option value="NLP">NLP</option>
                    <option value="Real-world AI">Real-world AI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Difficulty</label>
                  <select
                    value={questionForm.difficulty}
                    onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white cursor-pointer"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* 4 Options */}
              <div className="space-y-2">
                <label className="block text-slate-300 font-semibold">Options & Correct Answer</label>
                {(['A', 'B', 'C', 'D'] as OptionLetter[]).map((letter) => {
                  const key = `option_${letter.toLowerCase()}` as keyof typeof questionForm;
                  const isChecked = questionForm.correct_answer === letter;
                  return (
                    <div key={letter} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuestionForm({ ...questionForm, correct_answer: letter })}
                        className={`w-7 h-7 rounded-lg font-bold text-xs shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
                          isChecked ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                        title="Mark as correct answer"
                      >
                        {letter}
                      </button>
                      <input
                        type="text"
                        required
                        value={questionForm[key] as string}
                        onChange={(e) => setQuestionForm({ ...questionForm, [key]: e.target.value })}
                        placeholder={`Option ${letter} text...`}
                        className={`w-full px-3 py-1.5 bg-slate-950 border rounded-xl text-white text-xs ${
                          isChecked ? 'border-emerald-500' : 'border-slate-800'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Explanation</label>
                <textarea
                  rows={2}
                  value={questionForm.explanation}
                  onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                  placeholder="Explain why the correct answer is right with technical depth and a funny punchline..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
