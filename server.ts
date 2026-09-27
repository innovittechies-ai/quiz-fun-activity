import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db } from './src/server/db.js';
import { googleSheetsService } from './src/server/googleSheets.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'innovit2026';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'innovit.techies@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

app.use(express.json());

// In-memory set of verified active Google admin session tokens
const verifiedGoogleAdminTokens = new Map<string, { email: string; expiresAt: number; googleAccessToken: string }>();

// Request logger for debugging live events
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});

// Admin Authentication Middleware (supports Google Admin token OR emergency password)
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-admin-token'] || req.headers.authorization?.replace('Bearer ', '');
  if (!token || typeof token !== 'string') {
    res.status(401).json({ error: 'Unauthorized: Missing admin credentials' });
    return;
  }

  // Check 1: Emergency / configured admin password
  if (token === ADMIN_PASSWORD) {
    next();
    return;
  }

  // Check 2: Google Admin session token
  const session = verifiedGoogleAdminTokens.get(token);
  if (session && session.expiresAt > Date.now()) {
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized: Invalid or expired admin credentials' });
};

// ==========================================
// PUBLIC STUDENT QUIZ APIS
// ==========================================

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Innovit AI Quiz Portal', timestamp: new Date().toISOString() });
});

// Get Event public info
app.get('/api/events/:code', (req: Request, res: Response) => {
  try {
    const event = db.getEventByCode(req.params.code);
    if (!event) {
      res.status(404).json({ error: `Event code '${req.params.code}' was not found.` });
      return;
    }

    res.json({
      id: event.id,
      eventName: event.event_name,
      collegeName: event.college_name,
      eventCode: event.event_code,
      description: event.description,
      durationSeconds: event.duration_seconds,
      isActive: event.is_active,
      leaderboardEnabled: event.leaderboard_enabled,
      questionCount: event.question_ids.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Helper: inject the most recently verified Google admin token into googleSheetsService
function injectLatestGoogleToken() {
  const now = Date.now();
  for (const [, session] of verifiedGoogleAdminTokens) {
    if (session.expiresAt > now && session.googleAccessToken) {
      googleSheetsService.setAccessToken(session.googleAccessToken);
      return;
    }
  }
}

// Student registration and quiz start / resume
app.post('/api/quiz/register', (req: Request, res: Response) => {
  try {
    injectLatestGoogleToken();

    const { eventCode, fullName, identifier, collegeName, branch, year } = req.body;

    if (!eventCode || !fullName || !identifier) {
      res.status(400).json({ error: 'Event code, Full Name, and Mobile/Email are required.' });
      return;
    }

    const result = db.registerStudentAndStartQuiz({
      eventCode,
      fullName,
      identifier,
      collegeName: collegeName || '',
      branch,
      year,
      deviceInfo: req.headers['user-agent'] || '',
    });

    res.json({
      attemptId: result.attempt.id,
      participantId: result.participant.id,
      startedAt: result.attempt.started_at,
      durationSeconds: result.event.duration_seconds,
      remainingSeconds: result.remainingSeconds,
      questions: result.questions,
      existingAnswers: result.existingAnswers,
      isResumed: result.isResumed,
      event: {
        eventName: result.event.event_name,
        collegeName: result.event.college_name,
        eventCode: result.event.event_code,
      },
      participant: {
        fullName: result.participant.full_name,
        collegeName: result.participant.college_name,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

// Check attempt status and remaining timer
app.get('/api/quiz/attempt/:attemptId', (req: Request, res: Response) => {
  try {
    const attempt = db.getAttemptById(req.params.attemptId);
    if (!attempt) {
      res.status(404).json({ error: 'Attempt not found' });
      return;
    }

    const event = db.getEventById(attempt.event_id);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const now = Date.now();
    const startTime = new Date(attempt.started_at).getTime();
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    const remainingSeconds = Math.max(0, event.duration_seconds - elapsedSeconds);

    if (attempt.status === 'in_progress' && remainingSeconds <= 0) {
      // Auto-submit expired attempt on server
      const result = db.submitAttempt(attempt.id);
      res.json({
        status: 'completed',
        expired: true,
        remainingSeconds: 0,
        result,
      });
      return;
    }

    const answers = db.getAttemptAnswersMap(attempt.id);
    const questions = db.getClientQuestionsForEvent(event);

    res.json({
      attemptId: attempt.id,
      status: attempt.status,
      startedAt: attempt.started_at,
      durationSeconds: event.duration_seconds,
      remainingSeconds,
      questions,
      existingAnswers: answers,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Auto-save student's answer per question
app.post('/api/quiz/answer', (req: Request, res: Response) => {
  try {
    const { attemptId, questionId, selectedOption } = req.body;
    if (!attemptId || !questionId || !selectedOption) {
      res.status(400).json({ error: 'attemptId, questionId, and selectedOption are required.' });
      return;
    }

    db.saveAttemptAnswer(attemptId, questionId, selectedOption);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to record answer' });
  }
});

// Submit quiz for server-side score calculation
app.post('/api/quiz/submit', (req: Request, res: Response) => {
  try {
    injectLatestGoogleToken();

    const { attemptId, answers } = req.body;
    if (!attemptId) {
      res.status(400).json({ error: 'attemptId is required' });
      return;
    }

    const result = db.submitAttempt(attemptId, answers);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to submit quiz' });
  }
});

// Fetch past quiz result
app.get('/api/quiz/result/:attemptId', (req: Request, res: Response) => {
  try {
    const result = db.getAttemptResult(req.params.attemptId);
    if (!result) {
      res.status(404).json({ error: 'Quiz result not found or quiz is still in progress' });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch result' });
  }
});

// Public Leaderboard for an Event (anonymized: no emails or mobile numbers)
app.get('/api/leaderboard/:eventCode', (req: Request, res: Response) => {
  try {
    const data = db.getLeaderboard(req.params.eventCode);
    res.json(data);
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Leaderboard not found' });
  }
});

// ==========================================
// ADMIN APIS (Protected)
// ==========================================

// Google Admin Login via OAuth access token / id token
app.post('/api/admin/google-login', async (req: Request, res: Response) => {
  try {
    const { accessToken, spreadsheetId } = req.body;
    if (!accessToken) {
      res.status(400).json({ error: 'OAuth Access Token is required.' });
      return;
    }

    // Verify token with Google userinfo API
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      res.status(401).json({ error: 'Failed to verify Google account credentials.' });
      return;
    }

    const userInfo = await userInfoRes.json();
    const userEmail = (userInfo.email || '').toLowerCase().trim();

    // Check against authorized admin emails list
    const isAuthorized =
      ADMIN_EMAILS.length === 0 ||
      ADMIN_EMAILS.includes(userEmail) ||
      ADMIN_EMAILS.includes('*');

    if (!isAuthorized) {
      res.status(403).json({
        error: `Access Denied: Google account '${userEmail}' is not on the authorized Innovit admin list. Please contact Innovit superadmin or use the emergency passcode.`,
      });
      return;
    }

    // Attach token to googleSheetsService for live Google Sheets reads and writes
    googleSheetsService.setAccessToken(accessToken);
    if (spreadsheetId) {
      googleSheetsService.setSpreadsheetId(spreadsheetId);
    }

    // Generate secure session token
    const sessionToken = `g_admin_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    // Valid for 24 hours
    verifiedGoogleAdminTokens.set(sessionToken, {
      email: userEmail,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      googleAccessToken: accessToken,
    });

    res.json({
      success: true,
      token: sessionToken,
      adminUser: {
        email: userEmail,
        name: userInfo.name || 'Admin',
        picture: userInfo.picture,
      },
      sheetsConfigured: googleSheetsService.isConfigured(),
      spreadsheetUrl: googleSheetsService.getSpreadsheetUrl(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Google authentication failed' });
  }
});

// Admin Passkey Login (Fallback)
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { password, spreadsheetId, accessToken } = req.body;
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Invalid admin credentials' });
    return;
  }
  if (accessToken) {
    googleSheetsService.setAccessToken(accessToken);
  }
  if (spreadsheetId) {
    googleSheetsService.setSpreadsheetId(spreadsheetId);
  }
  res.json({
    success: true,
    token: ADMIN_PASSWORD,
    adminUser: { email: 'innovit.admin@innovit.org', name: 'Innovit Admin' },
    sheetsConfigured: googleSheetsService.isConfigured(),
    spreadsheetUrl: googleSheetsService.getSpreadsheetUrl(),
  });
});

// Configure or test Google Spreadsheet ID
app.post('/api/admin/sheets/config', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { spreadsheetId, accessToken } = req.body;
    if (spreadsheetId) {
      googleSheetsService.setSpreadsheetId(spreadsheetId.trim());
    }
    if (accessToken) {
      googleSheetsService.setAccessToken(accessToken.trim());
    }

    const initResult = await googleSheetsService.ensureSheetStructure();

    res.json({
      success: true,
      spreadsheetId: process.env.GOOGLE_SHEET_ID || spreadsheetId,
      spreadsheetUrl: googleSheetsService.getSpreadsheetUrl(),
      isConfigured: googleSheetsService.isConfigured(),
      structureStatus: initResult,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get current Google Sheets connection info
app.get('/api/admin/sheets/status', requireAdmin, (req: Request, res: Response) => {
  res.json({
    isConfigured: googleSheetsService.isConfigured(),
    spreadsheetUrl: googleSheetsService.getSpreadsheetUrl(),
    adminEmails: ADMIN_EMAILS,
  });
});

// Full database sync to all 5 Google Sheets tabs
app.post('/api/admin/sheets/sync-all', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { accessToken, spreadsheetId } = req.body || {};
    const headerToken = req.headers['x-google-access-token'] as string;
    const token = accessToken || headerToken;
    if (token) {
      googleSheetsService.setAccessToken(token.trim());
    }
    if (spreadsheetId) {
      googleSheetsService.setSpreadsheetId(spreadsheetId.trim());
    }
    const rawData = db.getRawData();
    const result = await googleSheetsService.syncAllData(rawData);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to sync database to Google Sheets' });
  }
});

// Admin Stats
app.get('/api/admin/stats', requireAdmin, (req: Request, res: Response) => {
  try {
    const stats = db.getAdminStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Events CRUD
app.get('/api/admin/events', requireAdmin, (req: Request, res: Response) => {
  try {
    const events = db.getAllEvents();
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/events', requireAdmin, (req: Request, res: Response) => {
  try {
    const created = db.createEvent(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/events/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const updated = db.updateEvent(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/events/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    db.deleteEvent(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Questions CRUD
app.get('/api/admin/questions', requireAdmin, (req: Request, res: Response) => {
  try {
    const topic = req.query.topic as string | undefined;
    const difficulty = req.query.difficulty as string | undefined;
    const questions = db.getAllQuestions({ topic, difficulty });
    res.json(questions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/questions', requireAdmin, (req: Request, res: Response) => {
  try {
    const created = db.createQuestion(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/questions/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const updated = db.updateQuestion(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/questions/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    db.deleteQuestion(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin View Attempts for an Event
app.get('/api/admin/attempts/:eventCode', requireAdmin, (req: Request, res: Response) => {
  try {
    const attempts = db.getEventAttemptsDetails(req.params.eventCode);
    res.json(attempts);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Admin Reset Attempt
app.post('/api/admin/attempts/:id/reset', requireAdmin, (req: Request, res: Response) => {
  try {
    db.resetAttempt(req.params.id);
    res.json({ success: true, message: 'Student attempt has been reset successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Export Event Results to CSV
app.get('/api/admin/export/:eventCode', requireAdmin, (req: Request, res: Response) => {
  try {
    const csv = db.exportEventCSV(req.params.eventCode);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="innovit_quiz_${req.params.eventCode.toLowerCase()}_results.csv"`,
    );
    res.send(csv);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// ==========================================
// VITE CLIENT INTEGRATION
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Innovit AI Quiz Portal server running at http://localhost:${PORT}`);
  });
}

export { app };
export default app;

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
