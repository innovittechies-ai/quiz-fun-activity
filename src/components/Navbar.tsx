import React from 'react';
import { Shield, Home } from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string, param?: string) => void;
  activeEventCode?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, activeEventCode }) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-emerald-200 bg-white/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo - links to Innovit Technologies */}
        <a
          href="https://www.innovittechnologies.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 focus:outline-none group bg-white rounded-lg px-1.5 py-1"
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
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                  : 'text-emerald-800 hover:text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Quiz</span>
            </button>
          )}

          <div className="h-5 w-[1px] bg-emerald-200 mx-1 hidden sm:block" />

          <button
            onClick={() => onNavigate('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border ${
              currentView === 'admin'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm'
                : 'text-emerald-700 hover:text-emerald-600 border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Admin</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
