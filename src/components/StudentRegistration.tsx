import React, { useState } from 'react';
import { Event } from '../types/index.js';
import {
  Sparkles,
  Clock,
  HelpCircle,
  Award,
  ArrowRight,
  School,
  User,
  Mail,
  GraduationCap,
  AlertCircle,
  Flame,
} from 'lucide-react';

interface StudentRegistrationProps {
  event: Event;
  onSubmit: (formData: {
    fullName: string;
    identifier: string;
    collegeName: string;
    branch: string;
    year: string;
  }) => Promise<void>;
  isLoading: boolean;
  errorMessage: string | null;
}

export const StudentRegistration: React.FC<StudentRegistrationProps> = ({
  event,
  onSubmit,
  isLoading,
  errorMessage,
}) => {
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [collegeName, setCollegeName] = useState(event.college_name || '');
  const [branch, setBranch] = useState('Computer Science & Engineering');
  const [customBranch, setCustomBranch] = useState('');
  const [year, setYear] = useState('3rd Year');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!fullName.trim()) {
      setLocalError('Please enter your full name.');
      return;
    }

    if (!identifier.trim()) {
      setLocalError('Please enter your mobile number or college email.');
      return;
    }

    // Basic format check: either at least 10 digits or contains '@'
    const cleanId = identifier.trim();
    const isPhone = /^[0-9+ -]{8,15}$/.test(cleanId);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanId);
    if (!isPhone && !isEmail) {
      setLocalError('Please enter a valid 10-digit mobile number or valid email address.');
      return;
    }

    if (!collegeName.trim()) {
      setLocalError('Please enter your college name.');
      return;
    }

    const finalBranch = branch === 'Other' ? (customBranch.trim() || 'Other') : branch;

    await onSubmit({
      fullName: fullName.trim(),
      identifier: cleanId,
      collegeName: collegeName.trim(),
      branch: finalBranch,
      year,
    });
  };

  const durationMinutes = Math.round(event.duration_seconds / 60);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
      {/* Event Banner Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-indigo-900/40 via-slate-900/90 to-slate-950 border border-indigo-500/30 p-6 sm:p-8 text-center shadow-2xl mb-8">
        {/* Glow backdrop */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Live College Challenge
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            {event.event_name}
          </h1>

          <div className="flex items-center justify-center gap-1.5 text-slate-300 text-sm font-medium mb-3">
            <School className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{event.college_name}</span>
          </div>

          <p className="text-slate-300 text-sm sm:text-base font-normal max-w-md mx-auto mb-6 italic text-indigo-200/90">
            "{event.description || 'How well do you really understand AI?'}"
          </p>

          {/* Quick Quiz Highlights */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-md mx-auto pt-2 border-t border-slate-800">
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col items-center">
              <HelpCircle className="w-5 h-5 text-indigo-400 mb-1" />
              <span className="text-xs text-slate-400 font-medium">Questions</span>
              <span className="text-sm font-bold text-white">5 MCQs</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col items-center">
              <Clock className="w-5 h-5 text-amber-400 mb-1" />
              <span className="text-xs text-slate-400 font-medium">Time Limit</span>
              <span className="text-sm font-bold text-white">{durationMinutes} Minutes</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col items-center">
              <Award className="w-5 h-5 text-emerald-400 mb-1" />
              <span className="text-xs text-slate-400 font-medium">Leaderboard</span>
              <span className="text-sm font-bold text-white">Live Rank</span>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Form */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Student Entry
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Fill your details to start. Exactly 1 official attempt per student.
          </p>
        </div>

        {(localError || errorMessage) && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-rose-200 font-medium">
              {localError || errorMessage}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Full Name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Identifier: Mobile or Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Mobile Number or Email <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. 9876543210 or student@college.edu"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Used to prevent duplicate attempts and recover your score. Private and never shown on public leaderboards.
            </p>
          </div>

          {/* College Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              College Name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <School className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                placeholder="e.g. Gyan Sagar College of Engineering"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Branch & Year Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Branch / Stream
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                >
                  <option value="Computer Science & Engineering">Computer Science (CSE)</option>
                  <option value="AI & Data Science">AI & Data Science (AI/DS)</option>
                  <option value="Information Technology">Information Technology (IT)</option>
                  <option value="Electronics & Communication">Electronics & Comm (ECE)</option>
                  <option value="Electrical Engineering">Electrical Engg (EEE)</option>
                  <option value="Mechanical Engineering">Mechanical Engg (ME)</option>
                  <option value="Civil Engineering">Civil Engg (CE)</option>
                  <option value="Other">Other / BCA / MCA</option>
                </select>
              </div>
              {branch === 'Other' && (
                <input
                  type="text"
                  placeholder="Specify branch..."
                  value={customBranch}
                  onChange={(e) => setCustomBranch(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Academic Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer"
              >
                <option value="1st Year">1st Year (Freshman)</option>
                <option value="2nd Year">2nd Year (Sophomore)</option>
                <option value="3rd Year">3rd Year (Junior)</option>
                <option value="4th Year">4th Year (Senior)</option>
                <option value="Postgraduate">Postgraduate / Masters</option>
              </select>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <p>⚡ The {durationMinutes}-minute countdown starts immediately upon pressing Start.</p>
            <p>🔄 If your page refreshes, don't worry! Your attempt and time resume automatically.</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-base shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Initializing Quiz...</span>
              </div>
            ) : (
              <>
                <span>START QUIZ NOW</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
