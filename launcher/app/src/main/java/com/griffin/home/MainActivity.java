package com.griffin.home;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

public class MainActivity extends Activity {
    private static final long AMAZON_HOME_PAUSE_MS = 10 * 60 * 1000;

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(true);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B0B0C"));
        web.setFocusable(false);
        web.setFocusableInTouchMode(false);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(true);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
        hideSystemUi();
    }

    @Override
    protected void onResume() {
        super.onResume();
        Prefs.resume(this);
        hideSystemUi();
        js("window.tv && tv.resume()");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        js("window.tv && tv.resume()");
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    /** Remote buttons go straight to the page, so focus never gets lost in the WebView. */
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        String key = keyName(e.getKeyCode());
        if (key == null) return super.dispatchKeyEvent(e);
        if (e.getAction() == KeyEvent.ACTION_DOWN) js("window.tv && tv.key('" + key + "')");
        return true;
    }

    private static String keyName(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_UP: return "up";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "down";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "left";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "right";
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER: return "ok";
            case KeyEvent.KEYCODE_BACK:
            case KeyEvent.KEYCODE_ESCAPE: return "back";
            case KeyEvent.KEYCODE_MENU: return "menu";
            default: return null;
        }
    }

    private void js(final String code) {
        if (web != null) web.post(() -> web.evaluateJavascript(code, null));
    }

    private ComponentName guardComponent() {
        return new ComponentName(this, HomeGuard.class);
    }

    private boolean guardEnabled() {
        String list = Settings.Secure.getString(getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return list != null && list.contains(guardComponent().flattenToString());
    }

    private boolean setGuard(boolean on) {
        String me = guardComponent().flattenToString();
        String list = Settings.Secure.getString(getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        StringBuilder out = new StringBuilder();
        if (list != null) {
            for (String s : TextUtils.split(list, ":")) {
                if (s.isEmpty() || s.equals(me)) continue;
                if (out.length() > 0) out.append(':');
                out.append(s);
            }
        }
        if (on) {
            if (out.length() > 0) out.append(':');
            out.append(me);
        }
        try {
            Settings.Secure.putString(getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, out.toString());
            Settings.Secure.putInt(getContentResolver(),
                    Settings.Secure.ACCESSIBILITY_ENABLED, out.length() > 0 ? 1 : 0);
            return true;
        } catch (SecurityException e) {
            return false;
        }
    }

    private void openAmazonHome() {
        Intent home = new Intent(Intent.ACTION_MAIN);
        home.addCategory(Intent.CATEGORY_HOME);
        home.setPackage(HomeGuard.AMAZON_LAUNCHER);
        home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(home);
    }

    /** Exposed to index.html as window.Android. */
    class Bridge {
        @JavascriptInterface
        public boolean installed(String pkg) {
            try {
                getPackageManager().getApplicationInfo(pkg, 0);
                return true;
            } catch (PackageManager.NameNotFoundException e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean launch(String pkg) {
            PackageManager pm = getPackageManager();
            Intent i = pm.getLeanbackLaunchIntentForPackage(pkg);
            if (i == null) i = pm.getLaunchIntentForPackage(pkg);
            if (i == null) return false;
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            return true;
        }

        @JavascriptInterface
        public void tvSettings() {
            Intent i = new Intent(Settings.ACTION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        }

        /** Amazon home for a few minutes (inputs, Amazon's app library), then ours again. */
        @JavascriptInterface
        public void amazonHome() {
            Prefs.pauseFor(MainActivity.this, AMAZON_HOME_PAUSE_MS);
            openAmazonHome();
        }

        @JavascriptInterface
        public float getAnim() {
            return Settings.Global.getFloat(getContentResolver(),
                    Settings.Global.WINDOW_ANIMATION_SCALE, 1f);
        }

        @JavascriptInterface
        public boolean setAnim(float scale) {
            try {
                Settings.Global.putFloat(getContentResolver(), Settings.Global.WINDOW_ANIMATION_SCALE, scale);
                Settings.Global.putFloat(getContentResolver(), Settings.Global.TRANSITION_ANIMATION_SCALE, scale);
                Settings.Global.putFloat(getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, scale);
                return true;
            } catch (SecurityException e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean guardOn() {
            return guardEnabled();
        }

        /** Off = Amazon's home comes back permanently, until turned on again from this app. */
        @JavascriptInterface
        public boolean setGuardOn(boolean on) {
            boolean ok = setGuard(on);
            if (ok && !on) web.post(MainActivity.this::openAmazonHome);
            return ok;
        }
    }
}
