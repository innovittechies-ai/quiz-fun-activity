import React, { useEffect, useState, useCallback } from 'react';
import { LeaderboardEntry } from '../types/index.js';
import { api } from '../services/api.js';
import {
  Trophy,
  Medal,
  Clock,
  Search,
  RotateCw,
  School,
  ArrowLeft,
  Sparkles,
  Users,
  ShieldCheck,
} from 'lucide-react';

interface LeaderboardProps {
  eventCode: string;
  onBack: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ eventCode, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    event: { eventName: string; collegeName: string; eventCode: string; leaderboardEnabled: boolean };
    leaderboard: LeaderboardEntry[];
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLeaderboard = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setIsRefreshing(true);
    try {
      const res = await api.getLeaderboard(eventCode);
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leaderboard');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [eventCode]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Auto-refresh interval (every 12 seconds during live college events)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLeaderboard(true);
    }, 12000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLeaderboard]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  const filtered = (data?.leaderboard || []).filter((entry) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      entry.participantName.toLowerCase().includes(term) ||
      (entry.branch && entry.branch.toLowerCase().includes(term)) ||
      entry.collegeName.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Quiz</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <Trophy className="w-7 h-7 text-amber-400" />
            <span>Live Event Leaderboard</span>
          </h1>
          {data?.event && (
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {data.event.eventName} &bull; {data.event.collegeName} (Code: {data.event.eventCode})
            </p>
          )}
        </div>

        {/* Controls: Auto-refresh & Manual Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0"
            />
            <span>Auto-refresh</span>
          </label>

          <button
            onClick={() => fetchLeaderboard(false)}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh now"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="mb-6 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Student privacy protected: phone numbers and emails are never displayed.</span>
        </div>
        <div className="flex items-center gap-1 font-semibold text-slate-300">
          <Users className="w-3.5 h-3.5 text-cyan-400" />
          <span>{data?.leaderboard.length || 0} Finished</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by student name or branch..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
        />
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading current rankings...</p>
        </div>
      ) : error ? (
        <div className="py-12 text-center p-6 bg-slate-900 rounded-2xl border border-slate-800">
          <p className="text-sm text-rose-400 font-semibold mb-2">{error}</p>
          <button
            onClick={() => fetchLeaderboard(false)}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-white font-medium hover:bg-slate-700 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center p-6 bg-slate-900/50 rounded-2xl border border-slate-800">
          <Trophy className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">
            {searchTerm ? 'No matching participants found' : 'No quiz completions yet'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm
              ? 'Try searching with another keyword.'
              : 'Be the first student to finish the quiz and claim the #1 spot!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const isFirst = entry.rank === 1;
            const isSecond = entry.rank === 2;
            const isThird = entry.rank === 3;

            return (
              <div
                key={`${entry.rank}-${entry.participantName}`}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                  isFirst
                    ? 'bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border-amber-500/50 shadow-lg shadow-amber-500/10'
                    : isSecond
                    ? 'bg-gradient-to-r from-slate-300/10 via-slate-900 to-slate-900 border-slate-400/40'
                    : isThird
                    ? 'bg-gradient-to-r from-amber-800/15 via-slate-900 to-slate-900 border-amber-700/40'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Left: Rank & Participant */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-sm sm:text-base shrink-0 ${
                      isFirst
                        ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 shadow-md shadow-amber-500/30'
                        : isSecond
                        ? 'bg-gradient-to-tr from-slate-200 to-slate-400 text-slate-950'
                        : isThird
                        ? 'bg-gradient-to-tr from-amber-700 to-amber-500 text-white'
                        : 'bg-slate-800 text-slate-400 font-mono'
                    }`}
                  >
                    {isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : `#${entry.rank}`}
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-white truncate flex items-center gap-1.5">
                      <span>{entry.participantName}</span>
                      {isFirst && <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
                      {entry.branch && (
                        <span className="truncate text-indigo-300 font-medium">{entry.branch}</span>
                      )}
                      {entry.branch && <span>&bull;</span>}
                      <span className="truncate">{entry.collegeName}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Score & Duration */}
                <div className="text-right shrink-0 flex items-center gap-3 sm:gap-5">
                  <div className="flex flex-col items-end">
                    <span className="text-base sm:text-xl font-black text-white font-mono flex items-center gap-1">
                      <span className={entry.score === entry.totalQuestions ? 'text-emerald-400' : 'text-cyan-300'}>
                        {entry.score}
                      </span>
                      <span className="text-slate-500 text-xs sm:text-sm">/{entry.totalQuestions}</span>
                    </span>

                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {formatSeconds(entry.durationTakenSeconds)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
