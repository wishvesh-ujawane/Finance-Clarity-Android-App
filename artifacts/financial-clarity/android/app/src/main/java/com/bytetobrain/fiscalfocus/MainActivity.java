package com.bytetobrain.fiscalfocus;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(BiometricSettingsPlugin.class);
        registerPlugin(ScreenSecurityPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
