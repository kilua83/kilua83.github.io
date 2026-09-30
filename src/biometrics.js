import { registerPlugin, Capacitor } from '@capacitor/core';

// Native plugin registered in MainActivity.java on Android
const NativeBiometric = registerPlugin('NativeBiometric');

/**
 * Checks if biometric authentication (fingerprint) is available on the device.
 */
export async function checkBiometricAvailable() {
  if (typeof window === 'undefined') return false;

  // Android Native (Capacitor)
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeBiometric.isAvailable();
      return !!(res && res.isAvailable);
    } catch (e) {
      console.warn('NativeBiometric check error:', e);
      return false;
    }
  }

  // Web Browser: check for WebAuthn platform authenticator (e.g. Windows Hello, TouchID, Android Chrome)
  if (window.PublicKeyCredential && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Triggers native biometric authentication prompt.
 */
export async function authenticateWithBiometrics(options = {}) {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeBiometric.verifyBiometric({
        title: options.title || 'Scadenziario',
        subtitle: options.subtitle || "Appoggia il dito sul sensore d'impronta",
        negativeButtonText: options.negativeButtonText || 'Usa password'
      });
      return res;
    } catch (e) {
      return {
        success: false,
        error: e?.message || 'Autenticazione biometrica non riuscita'
      };
    }
  }

  return {
    success: false,
    error: 'La biometria nativa è supportata sull’applicazione Android.'
  };
}
