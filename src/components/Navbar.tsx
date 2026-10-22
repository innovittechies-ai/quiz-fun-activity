import React from 'react';
import { ChevronDown, Shield } from 'lucide-react';

export type CampusView = 'home' | 'quiz' | 'qr' | 'leaderboard' | 'admin' | 'attendance';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: CampusView, param?: string) => void;
  activeEventCode?: string;
}

const PORTAL_OPTIONS: { value: CampusView; label: string; needsCode?: boolean }[] = [
  { value: 'home', label: 'Campus home' },
  { value: 'quiz', label: 'AI quiz', needsCode: true },
  { value: 'attendance', label: 'Zoom attendance' },
  { value: 'admin', label: 'Admin panel' },
];

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, activeEventCode }) => {
  const selectValue =
    currentView === 'qr' || currentView === 'leaderboard' ? 'quiz' : (currentView as CampusView);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-emerald-200 bg-white/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <a
          href="https://www.innovittechnologies.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 focus:outline-none group bg-white rounded-lg px-1.5 py-1 shrink-0"
          title="Visit Innovit Technologies"
        >
          <img
            src="/innovit-logo.png"
            alt="Innovit Technologies"
            className="h-8 w-auto transition-transform group-hover:scale-105"
          />
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative">
            <label htmlFor="campus-portal-nav" className="sr-only">
              Campus portal section
            </label>
            <select
              id="campus-portal-nav"
              value={selectValue}
              onChange={(e) => {
                const view = e.target.value as CampusView;
                if (view === 'quiz' && activeEventCode) {
                  onNavigate('quiz', activeEventCode);
                } else {
                  onNavigate(view);
                }
              }}
              className="appearance-none pl-3 pr-9 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-emerald-200 bg-white text-emerald-900 hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 cursor-pointer min-w-[10.5rem] sm:min-w-[12rem]"
            >
              {PORTAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
          </div>

          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className={`hidden sm:flex px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors items-center gap-1.5 cursor-pointer border ${
              currentView === 'admin'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm'
                : 'text-emerald-700 hover:text-emerald-600 border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Admin</span>
          </button>
        </div>
      </div>
    </header>
  );
};
