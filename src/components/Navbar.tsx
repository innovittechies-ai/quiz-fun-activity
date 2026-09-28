import React from 'react';
import { Shield, Home } from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string, param?: string) => void;
  activeEventCode?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, activeEventCode }) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo - links to Innovit Technologies */}
        <a
          href="https://www.innovittechnologies.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 focus:outline-none group"
          title="Visit Innovit Technologies"
        >
          <img
            src="/innovit-logo.png"
            alt="Innovit Technologies"
            className="h-8 w-auto transition-transform group-hover:scale-105"
          />
        </a>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          {activeEventCode && (
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
