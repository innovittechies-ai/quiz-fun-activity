import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const getGoogleClientId = (): string => {
  return (
    (import.meta as any).env.ViteGoogleClientId ||
    (import.meta as any).env.VITE_GOOGLE_CLIENT_ID ||
    (import.meta as any).env.GOOGLE_CLIENT_ID ||
    firebaseConfig.oAuthClientId ||
    ''
  );
};

/**
 * Direct Google OAuth 2.0 flow using Google Identity Services (GIS).
 * This connects directly to Google OAuth without going through Firebase Auth domain restrictions,
 * using the OAuth Client ID and Authorized JavaScript Origins configured in Google Cloud Console.
 */
export const signInWithGIS = async (): Promise<{ accessToken: string } | null> => {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error(
      'Google Client ID is missing. Please set ViteGoogleClientId in your Vercel environment variables or use the Admin Passkey.',
    );
  }

  // Check if google accounts script is loaded
  if (typeof window === 'undefined' || !(window as any).google?.accounts?.oauth2) {
    // Wait briefly in case script is still loading
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (!(window as any).google?.accounts?.oauth2) {
      throw new Error(
        'Google Identity Services is still loading. Please check your internet connection or use the Admin Passkey.',
      );
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES.join(' '),
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (!response.access_token) {
            reject(new Error('No access token returned from Google.'));
            return;
          }
          cachedAccessToken = response.access_token;
          resolve({ accessToken: response.access_token });
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || 'Google Sign-In was cancelled or failed'));
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(err);
    }
  });
};

/**
 * Unified Google Sign-In:
 * 1. Prefers direct Google Identity Services (avoids Firebase auth/unauthorized-domain errors on Vercel).
 * 2. Falls back to Firebase Auth signInWithPopup if GIS is unavailable.
 * 3. Gracefully reports auth/unauthorized-domain with clear actionable advice.
 */
export const googleSignIn = async (): Promise<{ accessToken: string } | null> => {
  isSigningIn = true;
  try {
    const clientId = getGoogleClientId();

    // If client ID is present and GIS is available in browser, use direct Google OAuth (bypasses Firebase domain whitelist)
    if (clientId && typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      try {
        return await signInWithGIS();
      } catch (gisErr: any) {
        console.warn('Direct Google GIS flow error, attempting Firebase fallback:', gisErr);
        if (
          gisErr.message?.includes('user_cancel') ||
          gisErr.message?.includes('closed') ||
          gisErr.message?.includes('denied')
        ) {
          throw gisErr;
        }
      }
    }

    // Fallback: Firebase signInWithPopup
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google.');
    }

    cachedAccessToken = credential.accessToken;
    return { accessToken: cachedAccessToken };
  } catch (error: any) {
    if (
      error.code === 'auth/unauthorized-domain' ||
      error.message?.includes('unauthorized-domain')
    ) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'your Vercel domain';
      throw new Error(
        `Firebase auth/unauthorized-domain: '${currentHost}' is not in Firebase's Authorized Domains list. Quick solution: Use the 'Admin Passkey' tab to log in immediately (passkey: innovit2026), or add '${currentHost}' to Firebase Console > Authentication > Settings > Authorized domains.`,
      );
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  try {
    await firebaseSignOut(auth);
  } catch {
    // ignore
  }
  cachedAccessToken = null;
};
