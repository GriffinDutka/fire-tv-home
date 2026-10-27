package com.griffin.home;

import android.accessibilityservice.AccessibilityService;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.media.AudioManager;
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
 *
 * Extra Home presses can cancel that held-back start, and while Amazon's home is already in front
 * they raise no new window event, so we keep asking for Griffin Home until it actually shows.
 *
 * It also replaces the look of the volume bar: the volume keys never reach apps, but SystemUI's
 * VolumePanel announces every change as a window event, so we draw VolumeIsland over it.
 */
public class HomeGuard extends AccessibilityService {
    static final String AMAZON_LAUNCHER = "com.amazon.tv.launcher";
    static final String SYSTEM_UI = "com.android.systemui";
    static final String SNAPSHOT = "home-snapshot.jpg";
    private static final long COVER_TIMEOUT_MS = 8000;
    private static final long UNCOVER_DELAY_MS = 250;
    private static final long RETRY_MS = 1500;
    private static final long GIVE_UP_MS = 20000;

    private static HomeGuard instance;

    private final Handler main = new Handler(Looper.getMainLooper());
    private ImageView cover;
    private VolumeIsland volume;
    private final Runnable removeCover = this::removeCover;
    private final Runnable retry = this::retry;
    private boolean amazonHomeFront;
    private long retryUntil;

    @Override
    protected void onServiceConnected() {
        instance = this;
        registerReceiver(volumeChanged, new IntentFilter(VOLUME_CHANGED));
    }

    /** Hidden AudioManager broadcast; fires on every level change (not at the ends, hence the events too). */
    private static final String VOLUME_CHANGED = "android.media.VOLUME_CHANGED_ACTION";
    private final BroadcastReceiver volumeChanged = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent.getIntExtra("android.media.EXTRA_VOLUME_STREAM_TYPE", -1) == AudioManager.STREAM_MUSIC) {
                showVolume();
            }
        }
    };

    @Override
    public void onDestroy() {
        main.removeCallbacks(retry);
        removeCover();
        try {
            unregisterReceiver(volumeChanged);
        } catch (IllegalArgumentException ignored) {
        }
        if (volume != null) volume.remove();
        if (instance == this) instance = null;
        super.onDestroy();
    }

    /** Called by MainActivity once it's on screen. */
    static void homeShown() {
        HomeGuard g = instance;
        if (g == null) return;
        g.amazonHomeFront = false;
        g.main.removeCallbacks(g.retry);
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
        String pkg = String.valueOf(event.getPackageName());
        if (SYSTEM_UI.equals(pkg)) {
            // The panel's later updates come as content/selection events with no class to go on,
            // so once it has opened, any SystemUI event keeps the island up.
            boolean open = event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                    && isVolumePanel(event);
            if (open || (volume != null && volume.isShowing())) showVolume();
            return;
        }
        if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
        if (getPackageName().equals(pkg)) return; // our own cover or screens; homeShown() handles those
        // Only the home grid itself; leave Amazon's other screens (search, inputs, etc.) alone.
        amazonHomeFront = AMAZON_LAUNCHER.equals(pkg)
                && String.valueOf(event.getClassName()).contains("HomeActivity");
        if (!amazonHomeFront) {
            main.removeCallbacks(retry);
            return;
        }
        if (Prefs.isPaused(this)) return;
        showCover();
        openHome();
        retryUntil = System.currentTimeMillis() + GIVE_UP_MS;
        main.removeCallbacks(retry);
        main.postDelayed(retry, RETRY_MS);
    }

    /** The stock panel's window class is VolumePanel$N; its updates come from a FrameLayout whose text is the level. */
    private static boolean isVolumePanel(AccessibilityEvent event) {
        if (String.valueOf(event.getClassName()).contains("VolumePanel")) return true;
        return event.getText().size() == 1 && String.valueOf(event.getText().get(0)).matches("\\d{1,3}");
    }

    private void showVolume() {
        AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
        int max = Math.max(1, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
        float value = am.getStreamVolume(AudioManager.STREAM_MUSIC) / (float) max;
        if (volume == null) volume = new VolumeIsland(this);
        volume.show(value, am.isStreamMute(AudioManager.STREAM_MUSIC));
    }

    private void retry() {
        if (!amazonHomeFront || Prefs.isPaused(this)) return;
        if (System.currentTimeMillis() > retryUntil) {
            removeCover();
            return;
        }
        showCover();
        openHome();
        main.postDelayed(retry, RETRY_MS);
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
