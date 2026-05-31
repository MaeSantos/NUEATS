package com.example.nueats;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Use the modern Android Splash Screen API
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }
}
