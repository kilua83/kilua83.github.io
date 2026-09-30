package it.kilua83.scadenziario;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

@CapacitorPlugin(name = "NativeBiometric")
public class NativeBiometricPlugin extends Plugin {

    @PluginMethod
    public void isAvailable(PluginCall call) {
        try {
            BiometricManager biometricManager = BiometricManager.from(getContext());
            int canAuthenticate = biometricManager.canAuthenticate(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK
            );

            JSObject ret = new JSObject();
            if (canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS) {
                ret.put("isAvailable", true);
                ret.put("hasEnrolled", true);
                ret.put("code", "SUCCESS");
            } else if (canAuthenticate == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
                ret.put("isAvailable", false);
                ret.put("hasEnrolled", false);
                ret.put("code", "NONE_ENROLLED");
            } else {
                ret.put("isAvailable", false);
                ret.put("hasEnrolled", false);
                ret.put("code", "NOT_SUPPORTED");
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Errore verifica biometria: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void verifyBiometric(PluginCall call) {
        String title = call.getString("title", "Autenticazione Scadenziario");
        String subtitle = call.getString("subtitle", "Usa l'impronta digitale per accedere");
        String negativeButtonText = call.getString("negativeButtonText", "Usa Password");

        getActivity().runOnUiThread(() -> {
            try {
                if (!(getActivity() instanceof FragmentActivity)) {
                    call.reject("Activity non supporta FragmentActivity");
                    return;
                }

                Executor executor = ContextCompat.getMainExecutor(getContext());
                BiometricPrompt biometricPrompt = new BiometricPrompt((FragmentActivity) getActivity(), executor,
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                                super.onAuthenticationError(errorCode, errString);
                                JSObject ret = new JSObject();
                                ret.put("success", false);
                                ret.put("error", errString.toString());
                                ret.put("errorCode", errorCode);
                                call.resolve(ret);
                            }

                            @Override
                            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                                super.onAuthenticationSucceeded(result);
                                JSObject ret = new JSObject();
                                ret.put("success", true);
                                call.resolve(ret);
                            }

                            @Override
                            public void onAuthenticationFailed() {
                                super.onAuthenticationFailed();
                            }
                        });

                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title)
                        .setSubtitle(subtitle)
                        .setNegativeButtonText(negativeButtonText)
                        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK)
                        .build();

                biometricPrompt.authenticate(promptInfo);
            } catch (Exception e) {
                call.reject("Errore avvio prompt biometrico: " + e.getMessage(), e);
            }
        });
    }
}
