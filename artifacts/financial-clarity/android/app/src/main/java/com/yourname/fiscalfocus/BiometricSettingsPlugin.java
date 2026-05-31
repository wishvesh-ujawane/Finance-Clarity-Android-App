package com.yourname.fiscalfocus;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BiometricSettings")
public class BiometricSettingsPlugin extends Plugin {
    private static final int BIOMETRIC_STRONG_OR_DEVICE_CREDENTIAL = 0x000F | 0x8000;

    @PluginMethod
    public void openEnrollment(PluginCall call) {
        Intent[] intents = buildEnrollmentIntents();

        for (Intent intent : intents) {
            if (!canOpenIntent(intent)) {
                continue;
            }

            try {
                getActivity().startActivity(intent);

                JSObject result = new JSObject();
                result.put("opened", true);
                result.put("action", intent.getAction());
                call.resolve(result);
                return;
            } catch (ActivityNotFoundException ignored) {
                // Try the next settings screen.
            }
        }

        call.reject("Unable to open Android biometric settings.");
    }

    private Intent[] buildEnrollmentIntents() {
        Intent biometricEnroll = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            biometricEnroll = new Intent(Settings.ACTION_BIOMETRIC_ENROLL);
            biometricEnroll.putExtra(
                Settings.EXTRA_BIOMETRIC_AUTHENTICATORS_ALLOWED,
                BIOMETRIC_STRONG_OR_DEVICE_CREDENTIAL
            );
        }

        Intent fingerprintEnroll = new Intent("android.settings.FINGERPRINT_ENROLL");
        Intent securitySettings = new Intent(Settings.ACTION_SECURITY_SETTINGS);
        Intent systemSettings = new Intent(Settings.ACTION_SETTINGS);

        if (biometricEnroll != null) {
            return new Intent[] { biometricEnroll, fingerprintEnroll, securitySettings, systemSettings };
        }
        return new Intent[] { fingerprintEnroll, securitySettings, systemSettings };
    }

    private boolean canOpenIntent(Intent intent) {
        Context context = getContext();
        PackageManager packageManager = context.getPackageManager();
        return intent.resolveActivity(packageManager) != null;
    }
}
