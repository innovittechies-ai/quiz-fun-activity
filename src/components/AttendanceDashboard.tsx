import React, { useCallback, useMemo, useState } from 'react';
import {
  Calendar,
  Copy,
  Download,
  Lock,
  Search,
  Users,
  Video,
  BarChart3,
  LogOut,
} from 'lucide-react';
import { api } from '../services/api.js';
import {
  categoryClass,
  rowsToCsv,
  type AttendanceMeeting,
  type StudentRow,
} from '../lib/attendance-format.js';

function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function formatMeetingStart(iso?: string) {
  if (!iso) return '—';
  try {
    const utc = new Date(iso.replace('Z', '+00:00'));
    const ist = new Date(utc.getTime() + (5 * 60 + 30) * 60 * 1000);
    return (
      ist.toLocaleString('en-IN', {
        timeZone: 'UTC',
        dateStyle: 'medium',
        timeStyle: 'short',
      }) + ' IST'
    );
  } catch {
    return iso;
  }
}

export const AttendanceDashboard: React.FC = () => {
  const [token, setToken] = useState(() => localStorage.getItem('innovit_admin_token') || '');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [date, setDate] = useState(yesterdayIso());
  const [meetings, setMeetings] = useState<AttendanceMeeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [meetingsError, setMeetingsError] = useState('');
  const [meetingsWarning, setMeetingsWarning] = useState('');

  const [selectedMeeting, setSelectedMeeting] = useState<AttendanceMeeting | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await api.admin.login(username, password);
      localStorage.setItem('innovit_admin_token', res.token);
      setToken(res.token);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('innovit_admin_token');
    setToken('');
    setStudents([]);
    setMeetings([]);
  };

  const loadMeetings = useCallback(async () => {
    if (!token) return;
    setMeetingsLoading(true);
    setMeetingsError('');
    setMeetingsWarning('');
    setSelectedMeeting(null);
    setStudents([]);
    try {
      const data = await api.admin.getAttendanceMeetings(token, date);
      setMeetings(data.meetings);
      if (data.warning) setMeetingsWarning(data.warning);
    } catch (err: any) {
      setMeetingsError(err.message);
      setMeetings([]);
    } finally {
      setMeetingsLoading(false);
    }
  }, [token, date]);

  const loadReport = useCallback(
    async (meeting: AttendanceMeeting, idOrUuid: string) => {
      if (!token) return;
      setSelectedMeeting(meeting);
      setReportLoading(true);
      setReportError('');
      setStudents([]);
      try {
        const len = meeting.duration ?? 90;
        const data = await api.admin.getAttendanceParticipants(token, idOrUuid, len);
        setStudents(data.students);
      } catch (err: any) {
        setReportError(err.message);
      } finally {
        setReportLoading(false);
      }
    },
    [token],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }, [students, search]);

  const stats = useMemo(() => {
    if (!students.length) return null;
    const avg = students.reduce((a, s) => a + s.durationMin, 0) / students.length;
    const max = Math.max(...students.map((s) => s.durationMin));
    const atRisk = students.filter((s) => s.category === 'At risk').length;
    return { avg: Math.round(avg), max, atRisk, total: students.length };
  }, [students]);

  function copyText(label: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  function downloadCsv() {
    const csv = rowsToCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campus-attendance-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!token) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-emerald-50 via-white to-emerald-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-emerald-200 rounded-2xl shadow-xl shadow-emerald-100 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-600 font-bold">Director access</p>
              <h2 className="text-xl font-black text-emerald-900">Zoom Attendance</h2>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-6">
            Sign in with the same admin credentials used for the quiz portal.
          </p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-emerald-400 outline-none text-slate-800"
              placeholder="Username"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-emerald-400 outline-none text-slate-800"
              placeholder="Password"
            />
            {loginError && <p className="text-red-600 text-sm">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50"
            >
              {loginLoading ? 'Signing in…' : 'Open attendance dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-emerald-50 via-white to-green-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-emerald-900 flex items-center gap-2">
              <Users className="w-8 h-8 text-emerald-600" />
              Student attendance
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              campusbyinnovit.com · Zoom session reports for leadership
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 px-3 py-2 rounded-lg border border-emerald-200 bg-white"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        <section className="bg-white border border-emerald-200 rounded-2xl shadow-lg shadow-emerald-100/50 p-6">
          <h2 className="font-bold text-emerald-900 flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5" />
            Find class sessions
          </h2>
          <div className="flex flex-wrap gap-3 items-center mb-4">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-emerald-200 text-slate-800"
            />
            <button
              type="button"
              onClick={loadMeetings}
              disabled={meetingsLoading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              {meetingsLoading ? 'Searching…' : 'Search'}
            </button>
          </div>
          {meetingsWarning && (
            <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm mb-4">
              {meetingsWarning}
            </p>
          )}
          {meetingsError && <p className="text-red-600 text-sm mb-4">{meetingsError}</p>}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {meetings.map((m, i) => (
              <article
                key={`${m.id}-${m.uuid ?? i}`}
                className={`rounded-xl border p-4 transition ${
                  selectedMeeting?.uuid === m.uuid && selectedMeeting?.id === m.id
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-300'
                    : 'border-emerald-100 bg-emerald-50/30 hover:border-emerald-300'
                }`}
              >
                <div className="flex gap-2 mb-2">
                  <Video className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <h3 className="font-semibold text-emerald-950 text-sm line-clamp-2">
                    {m.topic || 'Untitled session'}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mb-2">{formatMeetingStart(m.start_time)}</p>
                <p className="text-xs text-slate-600 mb-3">{m.duration ?? '—'} min</p>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => copyText(`id-${m.id}`, String(m.id))}
                    className="text-[11px] px-2 py-1 rounded-md bg-white border border-emerald-200 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    {copied === `id-${m.id}` ? 'Copied' : 'ID'}
                  </button>
                  {m.uuid && (
                    <button
                      type="button"
                      onClick={() => copyText(`uuid-${m.uuid}`, m.uuid!)}
                      className="text-[11px] px-2 py-1 rounded-md bg-white border border-emerald-200 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      {copied === `uuid-${m.uuid}` ? 'Copied' : 'UUID'}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => loadReport(m, m.uuid || String(m.id))}
                  disabled={reportLoading}
                  className="w-full py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  View attendance
                </button>
              </article>
            ))}
          </div>
        </section>

        {(reportLoading || students.length > 0 || reportError) && (
          <section className="bg-white border border-emerald-200 rounded-2xl shadow-lg p-6">
            <div className="flex flex-wrap justify-between gap-4 mb-6">
              <h2 className="font-bold text-emerald-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Performance report
              </h2>
              {students.length > 0 && (
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm flex items-center gap-2 hover:bg-emerald-500"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
              )}
            </div>

            {reportLoading && (
              <div className="flex justify-center py-12">
                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
              </div>
            )}
            {reportError && <p className="text-red-600 text-sm">{reportError}</p>}

            {stats && !reportLoading && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <Stat label="Students" value={String(stats.total)} />
                  <Stat label="Avg. minutes" value={`${stats.avg}`} />
                  <Stat label="Longest stay" value={`${stats.max}`} />
                  <Stat label="At risk" value={String(stats.atRisk)} highlight />
                </div>

                <div className="relative max-w-md mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Search student…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-emerald-200 outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>

                <div className="overflow-x-auto rounded-xl border border-emerald-100">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-emerald-50 text-emerald-800 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50">
                      {filtered.map((s) => (
                        <tr key={`${s.email}-${s.name}`} className="hover:bg-emerald-50/50">
                          <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                          <td className="px-4 py-3 text-slate-500">{s.email}</td>
                          <td className="px-4 py-3">{s.durationMin} min</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${categoryClass(s.category)}`}
                            >
                              {s.category}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
      <p className="text-xs text-emerald-700 uppercase tracking-wide font-bold">{label}</p>
      <p className={`text-2xl font-black mt-1 ${highlight ? 'text-red-600' : 'text-emerald-900'}`}>
        {value}
      </p>
    </div>
  );
}
