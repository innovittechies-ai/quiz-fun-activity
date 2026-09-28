import React, { useState, useEffect, useCallback } from 'react';
import { Event, ClientQuestion, OptionLetter, QuizResultPayload } from './types/index.js';
import { api, RegisterQuizResponse } from './services/api.js';
import { Navbar } from './components/Navbar.js';
import { StudentRegistration } from './components/StudentRegistration.js';
import { QuizPlayer } from './components/QuizPlayer.js';
import { QuizResult } from './components/QuizResult.js';
import { AdminPanel } from './components/AdminPanel.js';
import { Leaderboard } from './components/Leaderboard.js';
import { ProjectorView } from './components/ProjectorView.js';
import QRCode from 'qrcode';
import {
  ArrowRight,
  Shield,
  Clock,
  Award,
  QrCode,
} from 'lucide-react';

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<'home' | 'quiz' | 'qr' | 'leaderboard' | 'admin'>('home');
  const [activeEventCode, setActiveEventCode] = useState<string>('DEMO2026');

  // Event State
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  // Student Active Session State
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<ClientQuestion[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(300);
  const [initialAnswers, setInitialAnswers] = useState<Record<string, OptionLetter>>({});
  const [quizResult, setQuizResult] = useState<QuizResultPayload | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Landing Page QR Code State
  const [landingQrUrl, setLandingQrUrl] = useState<string>('');

  const effectiveLandingCode = (activeEventCode || 'DEMO2026').toUpperCase();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetUrl = `${window.location.origin}/quiz/${effectiveLandingCode}`;
    QRCode.toDataURL(targetUrl, {
      width: 440,
      margin: 2,
      color: {
        dark: '#030712',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setLandingQrUrl(url))
      .catch((err) => console.error('Error generating landing QR:', err));
  }, [effectiveLandingCode]);

  // Parse path from window.location
  const parseRoute = useCallback(() => {
    const path = window.location.pathname;
    if (path.startsWith('/admin')) {
      setCurrentView('admin');
    } else if (path.startsWith('/qr/')) {
      const code = path.replace('/qr/', '').split('/')[0].toUpperCase();
      if (code) setActiveEventCode(code);
      setCurrentView('qr');
    } else if (path.startsWith('/leaderboard/')) {
      const code = path.replace('/leaderboard/', '').split('/')[0].toUpperCase();
      if (code) setActiveEventCode(code);
      setCurrentView('leaderboard');
    } else if (path.startsWith('/quiz/')) {
      const code = path.replace('/quiz/', '').split('/')[0].toUpperCase();
      if (code) setActiveEventCode(code);
      setCurrentView('quiz');
    } else {
      setCurrentView('home');
    }
  }, []);

  useEffect(() => {
    parseRoute();
    const handlePopState = () => parseRoute();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parseRoute]);

  // Navigate helper
  const navigate = (view: 'home' | 'quiz' | 'qr' | 'leaderboard' | 'admin', paramCode?: string) => {
    const code = paramCode ? paramCode.toUpperCase() : activeEventCode;
    if (code) setActiveEventCode(code);
    setCurrentView(view);

    let targetUrl = '/';
    if (view === 'admin') targetUrl = '/admin';
    else if (view === 'quiz' && code) targetUrl = `/quiz/${code}`;
    else if (view === 'qr' && code) targetUrl = `/qr/${code}`;
    else if (view === 'leaderboard' && code) targetUrl = `/leaderboard/${code}`;

    window.history.pushState({}, '', targetUrl);
  };

  // Load event details whenever on quiz/qr/leaderboard
  useEffect(() => {
    if (!activeEventCode) return;
    let isMounted = true;

    async function loadEventData() {
      setEventLoading(true);
      setEventError(null);
      try {
        const ev = await api.getEvent(activeEventCode);
        if (isMounted) {
          setCurrentEvent(ev);
        }
      } catch (err: any) {
        if (isMounted) {
          setEventError(err.message || `Event '${activeEventCode}' not found`);
          setCurrentEvent(null);
        }
      } finally {
        if (isMounted) setEventLoading(false);
      }
    }

    loadEventData();
    return () => {
      isMounted = false;
    };
  }, [activeEventCode]);

  // Check existing session from localStorage for this event code to support instant page refresh recovery
  useEffect(() => {
    if (currentView !== 'quiz' || !activeEventCode) return;

    const storedAttemptId = localStorage.getItem(`innovit_attempt_${activeEventCode}`);
    if (storedAttemptId) {
      api
        .checkAttempt(storedAttemptId)
        .then((status) => {
          if (status.status === 'completed' || status.expired) {
            if (status.result) {
              setQuizResult(status.result);
            } else {
              api.getResult(storedAttemptId).then(setQuizResult);
            }
          } else if (status.status === 'in_progress') {
            setAttemptId(status.attemptId);
            setQuizQuestions(status.questions);
            setRemainingSeconds(status.remainingSeconds);
            setInitialAnswers(status.existingAnswers || {});
          }
        })
        .catch(() => {
          // If expired or not found, clear stale key
          localStorage.removeItem(`innovit_attempt_${activeEventCode}`);
        });
    }
  }, [currentView, activeEventCode]);

  // Handle student registration & start
  const handleStudentRegistration = async (formData: {
    fullName: string;
    identifier: string;
    collegeName: string;
    branch: string;
    year: string;
  }) => {
    setIsRegistering(true);
    setRegistrationError(null);

    try {
      const response: RegisterQuizResponse = await api.registerQuiz({
        eventCode: activeEventCode,
        fullName: formData.fullName,
        identifier: formData.identifier,
        collegeName: formData.collegeName,
        branch: formData.branch,
        year: formData.year,
      });

      // Save to localStorage for refresh recovery
      localStorage.setItem(`innovit_attempt_${activeEventCode}`, response.attemptId);

      setAttemptId(response.attemptId);
      setQuizQuestions(response.questions);
      setRemainingSeconds(response.remainingSeconds);
      setInitialAnswers(response.existingAnswers || {});
      setQuizResult(null);
    } catch (err: any) {
      setRegistrationError(err.message || 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  // Quiz submission completed
  const handleQuizCompleted = (result: QuizResultPayload) => {
    setQuizResult(result);
    setAttemptId(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Hide standard navbar in Fullscreen Projector mode for clean presentation */}
      {currentView !== 'qr' && (
        <Navbar
          currentView={currentView}
          onNavigate={(view, code) => navigate(view as any, code)}
          activeEventCode={activeEventCode}
        />
      )}

      <main className="flex-1">
        {/* VIEW: PROJECTOR QR */}
        {currentView === 'qr' && (
          <ProjectorView
            eventCode={activeEventCode}
            onBack={() => navigate('quiz', activeEventCode)}
            onOpenLeaderboard={(code) => navigate('leaderboard', code)}
          />
        )}

        {/* VIEW: ADMIN PANEL */}
        {currentView === 'admin' && (
          <AdminPanel
            onOpenProjector={(code) => navigate('qr', code)}
            onOpenLeaderboard={(code) => navigate('leaderboard', code)}
          />
        )}

        {/* VIEW: LEADERBOARD */}
        {currentView === 'leaderboard' && (
          <Leaderboard
            eventCode={activeEventCode}
            onBack={() => navigate('quiz', activeEventCode)}
          />
        )}

        {/* VIEW: QUIZ */}
        {currentView === 'quiz' && (
          <div>
            {eventLoading ? (
              <div className="py-24 text-center">
                <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-400 text-sm font-semibold">
                  Connecting to {activeEventCode}...
                </p>
              </div>
            ) : eventError ? (
              <div className="max-w-md mx-auto my-16 px-4 text-center">
                <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                  <h2 className="text-xl font-bold text-white mb-2">Event Not Found</h2>
                  <p className="text-xs sm:text-sm text-slate-400 mb-6">
                    {eventError}. Please double-check your event code or scan the projector QR code again.
                  </p>
                  <button
                    onClick={() => navigate('home')}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm"
                  >
                    Go to Portal Home
                  </button>
                </div>
              </div>
            ) : quizResult ? (
              <QuizResult
                result={quizResult}
                onHome={() => {
                  setQuizResult(null);
                  navigate('home');
                }}
              />
            ) : attemptId && quizQuestions.length > 0 ? (
              <QuizPlayer
                attemptId={attemptId}
                questions={quizQuestions}
                initialRemainingSeconds={remainingSeconds}
                initialAnswers={initialAnswers}
                onComplete={handleQuizCompleted}
                eventName={currentEvent?.event_name || 'Innovit AI Challenge'}
                collegeName={currentEvent?.college_name || ''}
              />
            ) : currentEvent ? (
              <StudentRegistration
                event={currentEvent}
                onSubmit={handleStudentRegistration}
                isLoading={isRegistering}
                errorMessage={registrationError}
              />
            ) : null}
          </div>
        )}

        {/* VIEW: HOME / LANDING */}
        {currentView === 'home' && (
          <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-emerald-50 via-green-50 to-emerald-100">
            <div className="max-w-4xl mx-auto px-4 py-10 sm:py-16">
            {/* Hero Banner */}
            <div className="text-center relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-300/30 blur-[120px] rounded-full pointer-events-none" />

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-6">
                  <Award className="w-4 h-4 text-emerald-600" />
                  Innovit Engineering College Events
                </div>

                <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-emerald-900 mb-4">
                  INNOVIT{' '}
                  <span className="bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-800 bg-clip-text text-transparent">
                    AI CHALLENGE
                  </span>
                </h1>

                <p className="text-lg sm:text-xl text-slate-700 font-medium max-w-xl mx-auto mb-8">
                  "How well do you really understand AI?"
                  <span className="block text-sm text-slate-500 mt-2 font-normal">
                    10 technically meaningful AI questions &bull; 10-minute server countdown &bull; Instant scoring.
                  </span>
                </p>

                {/* HERO QR CODE & FAST SCAN JOIN */}
                <div className="max-w-2xl mx-auto mb-8 p-6 rounded-3xl bg-white border border-emerald-200 shadow-xl shadow-emerald-200/50 relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-green-200/40 rounded-full blur-3xl pointer-events-none" />

                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* QR Code Container */}
                    <div className="shrink-0 flex flex-col items-center">
                      <div className="relative group p-3.5 bg-white rounded-2xl shadow-lg shadow-emerald-200/50 border-2 border-emerald-300">
                        {landingQrUrl ? (
                          <img
                            src={landingQrUrl}
                            alt={`Join Quiz QR Code for ${effectiveLandingCode}`}
                            className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-lg"
                          />
                        ) : (
                          <div className="w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center bg-emerald-50 rounded-lg">
                            <QrCode className="w-12 h-12 text-emerald-400 animate-pulse" />
                          </div>
                        )}
                        <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-md border border-emerald-400/50 flex items-center gap-1 shrink-0 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-ping" />
                          Scan with Mobile
                        </span>
                      </div>
                    </div>

                    {/* QR Details & Action Controls */}
                    <div className="flex-1 text-center md:text-left space-y-3">
                      <h3 className="text-xl font-black text-emerald-900">
                        Scan with Phone Camera to Start
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Point your phone camera at this QR code to open the registration form and start the 10-minute timed challenge instantly.
                      </p>

                      {/* Quick Action Button */}
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => navigate('quiz', effectiveLandingCode)}
                          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <span>Start on this Device</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Features Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto mt-12 pt-8 border-t border-emerald-200 text-left">
                  <div className="p-3">
                    <Clock className="w-5 h-5 text-amber-500 mb-1.5" />
                    <h4 className="text-xs font-bold text-emerald-900">Server-Timed</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Accurate countdown tracked on the database; page refreshes resume smoothly.
                    </p>
                  </div>

                  <div className="p-3">
                    <Award className="w-5 h-5 text-emerald-600 mb-1.5" />
                    <h4 className="text-xs font-bold text-emerald-900">Strict Scoring</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Evaluated strictly on the server; client answers are never trusted.
                    </p>
                  </div>

                  <div className="p-3">
                    <Shield className="w-5 h-5 text-emerald-700 mb-1.5" />
                    <h4 className="text-xs font-bold text-emerald-900">1 Attempt Policy</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Database enforces unique phone/email check with admin reset capabilities.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
