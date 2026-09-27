import fs from 'fs';
import path from 'path';

export interface AdminSession {
  email: string;
  expiresAt: number;
  googleAccessToken: string;
}

interface AuthFile {
  spreadsheetId?: string;
  googleAccessToken?: string;
  adminSessions: Record<string, AdminSession>;
}

const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'data')
  : path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'google_sheets_session.json');

let cache: AuthFile | null = null;

function readFile(): AuthFile {
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
      return {
        spreadsheetId: parsed.spreadsheetId,
        googleAccessToken: parsed.googleAccessToken,
        adminSessions: parsed.adminSessions || {},
      };
    }
  } catch (err) {
    console.error('Failed to read Google session file:', err);
  }
  return { adminSessions: {} };
}

export function loadPersistedAuth(): AuthFile {
  if (!cache) cache = readFile();
  return cache;
}

export function savePersistedAuth(partial: Partial<AuthFile>) {
  const current = loadPersistedAuth();
  cache = {
    spreadsheetId: partial.spreadsheetId ?? current.spreadsheetId,
    googleAccessToken: partial.googleAccessToken ?? current.googleAccessToken,
    adminSessions: partial.adminSessions ?? current.adminSessions ?? {},
  };
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist Google session:', err);
  }
}
