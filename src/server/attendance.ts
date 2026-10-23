import { participantEmailFromRaw, type RawParticipant } from './zoom.js';

export type StudentRow = {
  name: string;
  email: string;
  joinTimeIst: string;
  leaveTimeIst: string;
  durationMin: number;
  category: AttendanceCategory;
};

export type AttendanceCategory = 'Excellent' | 'Good' | 'Partial' | 'At risk';

type AggregatedParticipant = RawParticipant & { duration: number; mergedEmail: string };

export function convertToIst(utcTimeStr?: string): string {
  if (!utcTimeStr) return 'N/A';
  try {
    const utc = new Date(utcTimeStr.replace('Z', '+00:00'));
    const ist = new Date(utc.getTime() + (5 * 60 + 30) * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())} IST`;
  } catch {
    return utcTimeStr;
  }
}

function categorize(durationMin: number, sessionLengthMin: number): AttendanceCategory {
  const pct = sessionLengthMin > 0 ? durationMin / sessionLengthMin : 0;
  if (pct >= 0.9 || durationMin >= 90) return 'Excellent';
  if (pct >= 0.65 || durationMin >= 60) return 'Good';
  if (pct >= 0.35 || durationMin >= 30) return 'Partial';
  return 'At risk';
}

function dedupKey(p: RawParticipant): string {
  const email = participantEmailFromRaw(p);
  if (email) return `email:${email.toLowerCase()}`;
  const uid = p.user_id?.trim() || p.id?.trim();
  if (uid) return `uid:${uid}`;
  return `name:${(p.name?.trim() || 'Unknown').toLowerCase()}`;
}

export function processParticipants(
  participants: RawParticipant[],
  sessionLengthMin = 90,
): StudentRow[] {
  const unique = new Map<string, AggregatedParticipant>();

  for (const p of participants) {
    const key = dedupKey(p);
    const duration = p.duration ?? 0;
    const email = participantEmailFromRaw(p);
    const existing = unique.get(key);

    if (!existing) {
      unique.set(key, { ...p, duration, mergedEmail: email });
      continue;
    }

    const mergedEmail = existing.mergedEmail || email;
    const keep = duration > existing.duration ? p : existing;
    const maxDuration = Math.max(existing.duration, duration);

    unique.set(key, {
      ...keep,
      duration: maxDuration,
      mergedEmail,
      user_email: mergedEmail || keep.user_email,
      email: mergedEmail || keep.email,
    });
  }

  const rows: StudentRow[] = [];
  for (const p of unique.values()) {
    const durationMin = Math.floor((p.duration ?? 0) / 60);
    const displayEmail = p.mergedEmail || participantEmailFromRaw(p) || '—';
    rows.push({
      name: p.name?.trim() || 'Unknown',
      email: displayEmail,
      joinTimeIst: convertToIst(p.join_time),
      leaveTimeIst: convertToIst(p.leave_time),
      durationMin,
      category: categorize(durationMin, sessionLengthMin),
    });
  }

  return rows.sort((a, b) => b.durationMin - a.durationMin);
}
