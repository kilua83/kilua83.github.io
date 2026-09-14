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

export async function login(username, password) {
  if (username.trim().toLowerCase() !== ALLOWED_USER.toLowerCase()) {
    return { success: false, error: "Username non valido" };
  }

  try {
    const token = await decryptToken(password);
    if (!token || !token.startsWith("ghp_")) {
      return { success: false, error: "Password non corretta" };
    }
    sessionStorage.setItem(SESSION_KEY, token);
    sessionStorage.setItem(USER_KEY, username);
    return { success: true, token };
  } catch {
    return { success: false, error: "Password non corretta o credenziali errate" };
  }
}

export function getSessionToken() {
  return sessionStorage.getItem(SESSION_KEY) || null;
}

export function getSessionUser() {
  return sessionStorage.getItem(USER_KEY) || null;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(USER_KEY);
}
