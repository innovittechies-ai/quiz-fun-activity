export type AttendanceCategory = 'Excellent' | 'Good' | 'Partial' | 'At risk';

export type StudentRow = {
  name: string;
  email: string;
  joinTimeIst: string;
  leaveTimeIst: string;
  durationMin: number;
  category: AttendanceCategory;
};

export type AttendanceMeeting = {
  id: number | string;
  uuid?: string;
  topic?: string;
  start_time?: string;
  duration?: number;
};

export function categoryClass(cat: AttendanceCategory): string {
  switch (cat) {
    case 'Excellent':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Good':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Partial':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'At risk':
      return 'bg-red-100 text-red-800 border-red-200';
  }
}

export function rowsToCsv(rows: StudentRow[]): string {
  const header = 'Name,Email,Duration (min),Category,Join (IST),Leave (IST)';
  const lines = rows.map(
    (r) =>
      `"${r.name.replace(/"/g, '""')}","${r.email.replace(/"/g, '""')}",${r.durationMin},${r.category},"${r.joinTimeIst}","${r.leaveTimeIst}"`,
  );
  return '\uFEFF' + [header, ...lines].join('\n');
}
