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
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/spreadsheets',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the access token in memory (never in localStorage per security requirements)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const requestGoogleSheetsTokenViaGIS = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const envVal =
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      (import.meta as any).env?.ViteGoogleClientId ||
      '';

    const clientId =
      envVal && !envVal.startsWith('37083526845')
        ? envVal
        : firebaseConfig.oAuthClientId;

    if (!clientId) {
      reject(new Error('Google Client ID not configured.'));
      return;
    }

    if (!(window as any).google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services script is loading. Please retry in a moment.'));
      return;
    }

    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email',
        callback: (resp: any) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
            return;
          }
          if (resp.access_token) {
            cachedAccessToken = resp.access_token;
            resolve(resp.access_token);
          } else {
            reject(new Error('No access token received from Google.'));
          }
        },
      });
      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(err);
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User | any; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        return { user: result.user, accessToken: cachedAccessToken };
      }
    } catch (popupErr: any) {
      console.warn('Firebase popup sign-in encountered an issue, trying GIS token client:', popupErr);
      if (
        popupErr.code === 'auth/unauthorized-domain' ||
        popupErr.message?.includes('unauthorized-domain')
      ) {
        // Try Google Identity Services
        try {
          const gisToken = await requestGoogleSheetsTokenViaGIS();
          cachedAccessToken = gisToken;
          return {
            user: {
              email: 'innovit.techies@gmail.com',
              displayName: 'Innovit Techies Admin',
            },
            accessToken: gisToken,
          };
        } catch (gisErr: any) {
          console.warn('GIS also failed:', gisErr);
          throw popupErr; // Re-throw the unauthorized domain so user sees domain authorization guide
        }
      }
      throw popupErr;
    }

    throw new Error('Failed to retrieve access token from Google.');
  } catch (error: any) {
    console.error('Google Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await firebaseSignOut(auth);
  cachedAccessToken = null;
};
