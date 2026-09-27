import React from 'react';
import { Sparkles, Trophy, Tv, Shield, Home } from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string, param?: string) => void;
  activeEventCode?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, activeEventCode }) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform duration-300" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                INNOVIT
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                AI QUIZ
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              College Awareness & Career Portal
            </p>
          </div>
        </button>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          {activeEventCode && (
            <>
              <button
                onClick={() => onNavigate('quiz', activeEventCode)}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  currentView === 'quiz'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Quiz</span>
              </button>

              <button
                onClick={() => onNavigate('leaderboard', activeEventCode)}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  currentView === 'leaderboard'
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xs:inline">Leaderboard</span>
              </button>

              <button
                onClick={() => onNavigate('qr', activeEventCode)}
                title="Projector Mode (Big QR Code)"
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  currentView === 'qr'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Tv className="w-3.5 h-3.5 text-violet-400" />
                <span className="hidden sm:inline">Projector QR</span>
              </button>
            </>
          )}

          <div className="h-5 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

          <button
            onClick={() => onNavigate('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border ${
              currentView === 'admin'
                ? 'bg-slate-800 text-indigo-400 border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-slate-800 hover:bg-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>Admin</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
