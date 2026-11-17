package com.shiningsprk.deepseekchat;

import android.graphics.Insets;
import android.os.Build;
import android.view.WindowInsets;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 返回系统栏 / 刘海的安全区尺寸（单位：CSS px）。
 * Android WebView 的 env(safe-area-inset-*) 在部分机型上为 0，需要原生读数兜底。
 */
@CapacitorPlugin(name = "SafeArea")
public class SafeAreaPlugin extends Plugin {
    @PluginMethod
    public void getInsets(PluginCall call) {
        if (getActivity() == null) {
            call.reject("Activity is not available");
            return;
        }

        WindowInsets insets = getActivity().getWindow().getDecorView().getRootWindowInsets();
        int top = 0;
        int bottom = 0;
        if (insets != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets bars = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()
                );
                top = bars.top;
                bottom = bars.bottom;
            } else {
                top = insets.getSystemWindowInsetTop();
                bottom = insets.getSystemWindowInsetBottom();
            }
        }

        float density = getContext().getResources().getDisplayMetrics().density;
        JSObject result = new JSObject();
        result.put("top", Math.round(top / density));
        result.put("bottom", Math.round(bottom / density));
        call.resolve(result);
    }
}
