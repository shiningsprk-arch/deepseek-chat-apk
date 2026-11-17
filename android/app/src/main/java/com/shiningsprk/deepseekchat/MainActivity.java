package com.shiningsprk.deepseekchat;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AudioPermissionPlugin.class);
        registerPlugin(SafeAreaPlugin.class);
        registerPlugin(RecentMediaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
