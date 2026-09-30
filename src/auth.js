// Encrypted GitHub token (PBKDF2 + AES-GCM 256)
// Generated with salt + iv + ciphertext. Without the password it cannot be decrypted.
const ENCRYPTED_PAYLOAD = {
  salt: "o+l5jq7x+5/C8m8E1DlWcQ==",
  iv: "RbtpdGgW9pl4rxQr",
  ciphertext: "AdIT/VCZ00BMcneeI5c0dXfH2hhBoa9D7BVtKCE0DVkjpt4JVD+XzWPfpUzO5UZbmrbNO+mBYcA="
};

const ALLOWED_USER = "adigennaro";
const SESSION_KEY = "scadenziario_auth_token";
const USER_KEY = "scadenziario_auth_user";
const REMEMBER_KEY = "scadenziario_remember_me";
const PERSISTENT_TOKEN_KEY = "scadenziario_persistent_token";
const PERSISTENT_USER_KEY = "scadenziario_persistent_user";
const BIOMETRIC_ENABLED_KEY = "scadenziario_biometric_enabled";

function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decryptToken(password) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const salt = base64ToUint8Array(ENCRYPTED_PAYLOAD.salt);
  const iv = base64ToUint8Array(ENCRYPTED_PAYLOAD.iv);
  const ciphertext = base64ToUint8Array(ENCRYPTED_PAYLOAD.ciphertext);

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    ciphertext
  );

  return dec.decode(decrypted);
}

export async function login(username, password, remember = false, enableBiometrics = false) {
  if (username.trim().toLowerCase() !== ALLOWED_USER.toLowerCase()) {
    return { success: false, error: "Username non valido" };
  }

  try {
    const token = await decryptToken(password);
    if (!token || !token.startsWith("ghp_")) {
      return { success: false, error: "Password non corretta" };
    }

    sessionStorage.setItem(SESSION_KEY, token);
    sessionStorage.setItem(USER_KEY, username.trim());

    if (remember || enableBiometrics) {
      localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
      localStorage.setItem(PERSISTENT_TOKEN_KEY, token);
      localStorage.setItem(PERSISTENT_USER_KEY, username.trim());
    } else {
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(PERSISTENT_TOKEN_KEY);
      localStorage.removeItem(PERSISTENT_USER_KEY);
    }

    if (enableBiometrics) {
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
    } else {
      localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    }

    return { success: true, token, user: username.trim() };
  } catch {
    return { success: false, error: "Password non corretta o credenziali errate" };
  }
}

/**
 * Returns active token.
 * If "Ricordami" is active and biometric protection is not required every launch, auto-authenticate.
 */
export function getSessionToken() {
  if (typeof window === 'undefined') return null;

  const sessionToken = sessionStorage.getItem(SESSION_KEY);
  if (sessionToken) return sessionToken;

  const isRemembered = localStorage.getItem(REMEMBER_KEY) === "true";
  const isBiometric = localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true";

  if (isRemembered && !isBiometric) {
    const token = localStorage.getItem(PERSISTENT_TOKEN_KEY);
    if (token) {
      sessionStorage.setItem(SESSION_KEY, token);
      const user = localStorage.getItem(PERSISTENT_USER_KEY) || ALLOWED_USER;
      sessionStorage.setItem(USER_KEY, user);
      return token;
    }
  }

  return null;
}

export function getSessionUser() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(USER_KEY) || localStorage.getItem(PERSISTENT_USER_KEY) || ALLOWED_USER;
}

export function hasSavedSession() {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(PERSISTENT_TOKEN_KEY);
}

export function getRememberPreference() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(REMEMBER_KEY) === "true";
}

export function isBiometricEnabled() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true";
}

export function setBiometricPreference(enabled) {
  if (typeof window === 'undefined') return;
  if (enabled) {
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
  } else {
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  }
}

export function loginWithSavedToken() {
  if (typeof window === 'undefined') return { success: false, error: 'Dispositivo non supportato' };
  const token = localStorage.getItem(PERSISTENT_TOKEN_KEY);
  const user = localStorage.getItem(PERSISTENT_USER_KEY) || ALLOWED_USER;

  if (token && token.startsWith("ghp_")) {
    sessionStorage.setItem(SESSION_KEY, token);
    sessionStorage.setItem(USER_KEY, user);
    return { success: true, token, user };
  }
  return { success: false, error: 'Nessuna credenziale salvata su questo dispositivo' };
}

export function logout() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  localStorage.removeItem(PERSISTENT_TOKEN_KEY);
  localStorage.removeItem(PERSISTENT_USER_KEY);
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
}
