import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Event } from '../types/index.js';
import { api } from '../services/api.js';
import {
  Maximize,
  Minimize,
  Copy,
  Check,
  Sparkles,
  School,
  Clock,
  HelpCircle,
  Trophy,
  Users,
  ArrowLeft,
  Tv,
} from 'lucide-react';

interface ProjectorViewProps {
  eventCode: string;
  onBack: () => void;
  onOpenLeaderboard: (code: string) => void;
}

export const ProjectorView: React.FC<ProjectorViewProps> = ({
  eventCode,
  onBack,
  onOpenLeaderboard,
}) => {
  const [event, setEvent] = useState<Event | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const quizUrl = `${window.location.origin}/quiz/${eventCode}`;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const ev = await api.getEvent(eventCode);
        setEvent(ev);

        // Generate high-resolution QR Code
        const url = await QRCode.toDataURL(quizUrl, {
          width: 600,
          margin: 2,
          color: {
            dark: '#030712', // deep slate/black for extreme projector contrast
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'H',
        });
        setQrDataUrl(url);

        // Fetch initial count
        try {
          const lb = await api.getLeaderboard(eventCode);
          setParticipantCount(lb.leaderboard.length);
        } catch (e) {
          // ignore
        }
      } catch (err: any) {
        setError(err.message || 'Could not load event for projector');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [eventCode, quizUrl]);

  // Periodic poll of participants count for live audience excitement
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const lb = await api.getLeaderboard(eventCode);
        setParticipantCount(lb.leaderboard.length);
      } catch (e) {}
    }, 6000);
    return () => clearInterval(timer);
  }, [eventCode]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(quizUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-slate-300">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mb-4" />
        <p className="text-base font-semibold">Preparing Projector Display...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-slate-900 rounded-2xl border border-slate-800 text-center">
        <p className="text-rose-400 font-semibold mb-4">{error || 'Event not found'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm"
        >
          Back to Portal
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-8 relative selection:bg-indigo-500 selection:text-white"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-indigo-600/15 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-500/10 blur-[120px] pointer-events-none rounded-full" />

      {/* Top Floating Controls */}
      <header className="relative z-20 flex items-center justify-between max-w-7xl mx-auto w-full">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Projector</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Event Live</span>
          </div>

          <button
            onClick={() => onOpenLeaderboard(eventCode)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Leaderboard</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Center Projector Stage */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center my-6 max-w-4xl mx-auto w-full">
        {/* Event Title & College */}
        <div className="mb-4 sm:mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-xs sm:text-sm font-extrabold uppercase tracking-widest mb-3 shadow-sm">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            INNOVIT AI CHALLENGE
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-2">
            {event.event_name}
          </h1>

          <div className="flex items-center justify-center gap-2 text-slate-300 text-base sm:text-xl font-medium">
            <School className="w-5 h-5 text-indigo-400" />
            <span>{event.college_name}</span>
          </div>

          <p className="text-sm sm:text-lg text-slate-400 max-w-xl mx-auto mt-2 italic">
            "How well do you really understand AI?"
          </p>
        </div>

        {/* Huge High-Contrast QR Code Card */}
        <div className="relative group p-4 sm:p-6 bg-gradient-to-b from-white via-white to-slate-100 rounded-3xl shadow-2xl shadow-cyan-500/20 border-4 border-cyan-400 max-w-xs sm:max-w-sm w-full mx-auto transform transition-transform hover:scale-[1.01]">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan to join quiz"
              className="w-full aspect-square rounded-2xl object-contain block mx-auto"
            />
          ) : (
            <div className="w-full aspect-square bg-slate-200 animate-pulse rounded-2xl" />
          )}

          <div className="mt-3 text-center">
            <p className="text-slate-900 font-black text-sm sm:text-base uppercase tracking-wider">
              Scan with your phone camera
            </p>
          </div>
        </div>

        {/* Direct Link and Event Code Badge */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
          {/* Event Code Badge */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700">
            <span className="text-xs text-slate-400 uppercase font-semibold">Event Code:</span>
            <span className="font-mono text-base font-extrabold text-cyan-300 tracking-wider">
              {event.event_code}
            </span>
          </div>

          {/* Quick Copy Link */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-xs sm:text-sm text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300 font-semibold">Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-cyan-400" />
                <span className="truncate max-w-[180px] font-mono text-xs">{quizUrl}</span>
              </>
            )}
          </button>
        </div>

        {/* Rules Badges */}
        <div className="mt-6 grid grid-cols-3 gap-3 max-w-lg w-full">
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
            <Clock className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <span className="text-xs text-slate-400 block font-medium">Duration</span>
            <span className="text-sm sm:text-base font-bold text-white">5 Minutes</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
            <HelpCircle className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
            <span className="text-xs text-slate-400 block font-medium">Format</span>
            <span className="text-sm sm:text-base font-bold text-white">5 MCQs</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
            <Users className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <span className="text-xs text-slate-400 block font-medium">Finished</span>
            <span className="text-sm sm:text-base font-bold text-emerald-300 font-mono">
              {participantCount} Students
            </span>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 text-center text-xs text-slate-500 max-w-2xl mx-auto w-full pt-4 border-t border-slate-900">
        <p>Innovit AI Quiz Platform &bull; Real-time server-synced evaluation &bull; Press F11 for Fullscreen</p>
      </footer>
    </div>
  );
};
