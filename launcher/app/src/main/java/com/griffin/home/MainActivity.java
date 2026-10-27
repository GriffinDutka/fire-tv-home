package com.griffin.home;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends Activity {
    private static final long AMAZON_HOME_PAUSE_MS = 10 * 60 * 1000;
    private static final long SNAPSHOT_DELAY_MS = 1500;
    private static final long SNAPSHOT_EVERY_MS = 60 * 1000;
    private static final long HOLD_MS = 550;

    private WebView web;
    private boolean resumed;
    private boolean okDown, okHeld;
    private final Runnable snapshot = this::snapshot;

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
        ws.setAllowFileAccessFromFileURLs(true); // app banners and stills are file:// images outside the assets
        web.addJavascriptInterface(new Bridge(), "Android");
        // Film stills for the home backdrop; aerial count for Settings.
        web.addJavascriptInterface(new Media(this, "stills", ".jpg", null), "Stills");
        web.addJavascriptInterface(new Media(this, "aerials", ".mov", null), "Aerials");
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
        resumed = true;
        HomeGuard.homeShown();
        web.removeCallbacks(snapshot);
        web.postDelayed(snapshot, SNAPSHOT_DELAY_MS);
    }

    @Override
    protected void onPause() {
        resumed = false;
        web.removeCallbacks(snapshot);
        super.onPause();
    }

    /** Picture of the home screen that HomeGuard flashes over Amazon's home while ours starts. */
    private void snapshot() {
        if (!resumed || web.getWidth() == 0) return;
        try {
            Bitmap b = Bitmap.createBitmap(web.getWidth(), web.getHeight(), Bitmap.Config.RGB_565);
            web.draw(new Canvas(b));
            final Bitmap img = b;
            new Thread(() -> {
                File tmp = new File(getFilesDir(), HomeGuard.SNAPSHOT + ".tmp");
                try (FileOutputStream out = new FileOutputStream(tmp)) {
                    img.compress(Bitmap.CompressFormat.JPEG, 85, out);
                } catch (Exception e) {
                    return;
                } finally {
                    img.recycle();
                }
                tmp.renameTo(new File(getFilesDir(), HomeGuard.SNAPSHOT));
            }).start();
        } catch (RuntimeException | OutOfMemoryError ignored) {
        }
        web.postDelayed(snapshot, SNAPSHOT_EVERY_MS);
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

    /**
     * Remote buttons go straight to the page, so focus never gets lost in the WebView.
     * OK fires on release so holding it can mean something else (options, like tvOS).
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        String key = keyName(e.getKeyCode());
        if (key == null) return super.dispatchKeyEvent(e);
        boolean down = e.getAction() == KeyEvent.ACTION_DOWN;
        if (key.equals("ok")) {
            if (down && e.getRepeatCount() == 0) {
                okDown = true;
                okHeld = false;
            } else if (down && okDown && !okHeld && e.getEventTime() - e.getDownTime() >= HOLD_MS) {
                okHeld = true;
                sendKey("hold");
            } else if (!down && okDown) {
                // A release without its press (e.g. the press went to HomeGuard's cover) does nothing.
                if (!okHeld) sendKey("ok");
                okDown = false;
            }
            return true;
        }
        if (down) sendKey(key);
        return true;
    }

    private void sendKey(String key) {
        js("window.tv && tv.key('" + key + "')");
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

    private static void render(Drawable d, int w, int h, File out) throws Exception {
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        d.setBounds(0, 0, w, h);
        d.draw(new Canvas(b));
        File tmp = new File(out.getPath() + ".tmp");
        try (FileOutputStream o = new FileOutputStream(tmp)) {
            b.compress(Bitmap.CompressFormat.PNG, 100, o);
        } finally {
            b.recycle();
        }
        if (!tmp.renameTo(out)) throw new Exception("rename");
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

        /** Every launchable app: [{pkg, name}], A–Z. Leanback (TV) entries win over phone ones. */
        @JavascriptInterface
        public String apps() {
            PackageManager pm = getPackageManager();
            Map<String, String> found = new LinkedHashMap<>();
            for (String cat : new String[]{Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER}) {
                Intent i = new Intent(Intent.ACTION_MAIN).addCategory(cat);
                for (ResolveInfo ri : pm.queryIntentActivities(i, 0)) {
                    String pkg = ri.activityInfo.packageName;
                    if (pkg.equals(getPackageName()) || pkg.equals(HomeGuard.AMAZON_LAUNCHER)) continue;
                    if (!found.containsKey(pkg)) found.put(pkg, String.valueOf(ri.loadLabel(pm)));
                }
            }
            List<String> pkgs = new ArrayList<>(found.keySet());
            Collections.sort(pkgs, (a, b) -> found.get(a).compareToIgnoreCase(found.get(b)));
            JSONArray out = new JSONArray();
            try {
                for (String pkg : pkgs) out.put(new JSONObject().put("pkg", pkg).put("name", found.get(pkg)));
            } catch (Exception ignored) {
            }
            return out.toString();
        }

        /**
         * The app's TV banner (or its icon if it has none) as a PNG in the cache, so tiles load it
         * like any image: {src, banner}. Re-rendered when the app updates.
         */
        @JavascriptInterface
        public String icon(String pkg) {
            if (pkg.contains("/")) return null;
            try {
                PackageManager pm = getPackageManager();
                long updated = pm.getPackageInfo(pkg, 0).lastUpdateTime;
                File dir = new File(getCacheDir(), "icons");
                dir.mkdirs();
                String stem = pkg + "-" + updated;
                File banner = new File(dir, stem + "-b.png"), icon = new File(dir, stem + "-i.png");
                if (!banner.exists() && !icon.exists()) {
                    File[] old = dir.listFiles((d, n) -> n.startsWith(pkg + "-"));
                    if (old != null) for (File f : old) f.delete();
                    Drawable d = null;
                    Intent tv = pm.getLeanbackLaunchIntentForPackage(pkg);
                    if (tv != null) d = pm.getActivityBanner(tv);
                    if (d == null) d = pm.getApplicationBanner(pkg);
                    boolean isBanner = d != null;
                    if (d == null) d = pm.getApplicationIcon(pkg);
                    render(d, isBanner ? 320 : 192, isBanner ? 180 : 192, isBanner ? banner : icon);
                }
                boolean isBanner = banner.exists();
                return new JSONObject()
                        .put("src", "file://" + (isBanner ? banner : icon).getAbsolutePath())
                        .put("banner", isBanner).toString();
            } catch (Exception e) {
                return null;
            }
        }

        @JavascriptInterface
        public void startScreensaver() {
            startActivity(new Intent(MainActivity.this, ScreensaverActivity.class));
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
