package com.griffin.home;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.widget.ImageView;

import java.io.File;

/**
 * Makes the remote's Home button open Griffin Home.
 *
 * Fire OS handles the real remote's Home before accessibility key filtering, and Android then
 * blocks other apps from starting for ~5s (app-switch protection). So when Amazon's home shows up
 * we instantly cover it with a snapshot of Griffin Home (overlays aren't subject to that delay),
 * swallow remote presses so nothing underneath gets clicked, and drop the cover once the real
 * activity has resumed.
 */
public class HomeGuard extends AccessibilityService {
    static final String AMAZON_LAUNCHER = "com.amazon.tv.launcher";
    static final String SNAPSHOT = "home-snapshot.jpg";
    private static final long COVER_TIMEOUT_MS = 8000;
    private static final long UNCOVER_DELAY_MS = 250;

    private static HomeGuard instance;

    private final Handler main = new Handler(Looper.getMainLooper());
    private ImageView cover;
    private final Runnable removeCover = this::removeCover;

    @Override
    protected void onServiceConnected() {
        instance = this;
    }

    @Override
    public void onDestroy() {
        removeCover();
        if (instance == this) instance = null;
        super.onDestroy();
    }

    /** Called by MainActivity once it's on screen. */
    static void homeShown() {
        HomeGuard g = instance;
        if (g == null) return;
        g.main.removeCallbacks(g.removeCover);
        g.main.postDelayed(g.removeCover, UNCOVER_DELAY_MS);
    }

    @Override
    protected boolean onKeyEvent(KeyEvent event) {
        if (cover != null) return true; // covering Amazon's home: don't let presses reach it
        if (event.getKeyCode() != KeyEvent.KEYCODE_HOME || Prefs.isPaused(this)) return false;
        if (event.getAction() == KeyEvent.ACTION_UP) openHome();
        return true;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
        if (!AMAZON_LAUNCHER.contentEquals(String.valueOf(event.getPackageName()))) return;
        // Only the home grid itself; leave Amazon's other screens (search, inputs, etc.) alone.
        if (!String.valueOf(event.getClassName()).contains("HomeActivity")) return;
        if (Prefs.isPaused(this)) return;
        showCover();
        openHome();
    }

    private void openHome() {
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        startActivity(i);
    }

    private void showCover() {
        main.removeCallbacks(removeCover);
        main.postDelayed(removeCover, COVER_TIMEOUT_MS);
        if (cover != null) return;
        ImageView v = new ImageView(this);
        v.setBackgroundColor(Color.parseColor("#0B0B0C"));
        v.setScaleType(ImageView.ScaleType.FIT_XY);
        File snap = new File(getFilesDir(), SNAPSHOT);
        if (snap.exists()) {
            Bitmap b = BitmapFactory.decodeFile(snap.getPath());
            if (b != null) v.setImageBitmap(b);
        }
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_FULLSCREEN,
                PixelFormat.OPAQUE);
        try {
            ((WindowManager) getSystemService(WINDOW_SERVICE)).addView(v, lp);
            cover = v;
        } catch (RuntimeException ignored) {
        }
    }

    private void removeCover() {
        main.removeCallbacks(removeCover);
        if (cover == null) return;
        try {
            ((WindowManager) getSystemService(WINDOW_SERVICE)).removeView(cover);
        } catch (RuntimeException ignored) {
        }
        cover = null;
    }

    @Override
    public void onInterrupt() {}
}
