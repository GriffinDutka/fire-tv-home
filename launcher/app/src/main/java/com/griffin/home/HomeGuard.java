package com.griffin.home;

import android.accessibilityservice.AccessibilityService;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.media.AudioManager;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Process;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.widget.FrameLayout;
import android.widget.ImageView;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Locale;

/**
 * Makes the remote's Home button open Griffin Home.
 *
 * Fire OS handles the real remote's Home before accessibility key filtering, and Android then
 * blocks other apps from starting for ~5s (app-switch protection; openHome() gets around it). So
 * when Amazon's home shows up we instantly cover it with a snapshot of Griffin Home, swallow remote
 * presses so nothing underneath gets clicked, and drop the cover once the real Home has drawn.
 *
 * Extra Home presses can cancel that held-back start, and while Amazon's home is already in front
 * they raise no new window event, so we keep asking for Griffin Home until it actually shows.
 *
 * The Home key itself never reaches onKeyEvent, and Amazon's window event comes ~250ms after the
 * press, often after Amazon's home has drawn (and not at all when it's already in front). So we also
 * read the system log, where Fire OS's start of Amazon's home shows ~5ms after the press: the cover
 * goes up then, and the press ends Amazon home's pause, since only our Amazon home tile should leave
 * Amazon's home up. Needs READ_LOGS, which install-launcher.sh grants; without it the window event
 * is all we have.
 *
 * It also replaces the look of the volume bar: the volume keys never reach apps, but SystemUI's
 * VolumePanel announces every change as a window event, so we draw VolumeIsland over it.
 */
public class HomeGuard extends AccessibilityService {
    static final String AMAZON_LAUNCHER = "com.amazon.tv.launcher";
    static final String SYSTEM_UI = "com.android.systemui";
    static final String SNAPSHOT = "home-snapshot.jpg";
    private static final long COVER_TIMEOUT_MS = 8000;
    // Once Home has drawn; or, should that word never come (the page still loading), this long after it resumed.
    private static final long UNCOVER_DELAY_MS = 100;
    private static final long UNCOVER_FALLBACK_MS = 1500;
    // And not until this long after the last press: Fire OS can log a press ~400ms late, so with the
    // cover already down, a quick next press showed Amazon's home (or black) before we knew of it.
    // Kept up over Home instead, that press lands under it; any other key drops it at once.
    private static final long HOLD_AFTER_PRESS_MS = 1200;
    private static final long RETRY_MS = 1500;
    private static final long GIVE_UP_MS = 20000;
    private static final long LOGCAT_RESTART_MS = 10000;
    private static final long NUDGE_MS = 60 * 60 * 1000;
    private static final long PRESS_EVENT_MS = 1000;
    private static final String ACTION_NUDGE = "com.griffin.home.NUDGE";

    private static HomeGuard instance;

    // The cover lives on its own thread: pressing Home from Home finds the main one busy pausing the
    // WebView, which held the cover back ~240ms.
    private final Handler guard = startThread();
    private FrameLayout coverWindow;
    private ImageView cover;
    private Bitmap coverShows;
    private volatile boolean covering;
    private volatile long coveredAt, shownAt;
    private VolumeIsland volume;
    private final Runnable removeCover = this::removeCover;
    private final Runnable uncover = this::uncover;
    private final Runnable retry = this::retry;
    private boolean amazonHomeFront;
    private long retryUntil;
    private long pressedAt;
    // Decoded ahead of time: decoding it when Amazon's home appeared took ~150ms, long enough for it to show.
    private volatile Bitmap snapshot;
    private Thread watcher;
    private volatile java.lang.Process logcat;

    @Override
    protected void onServiceConnected() {
        instance = this;
        registerReceiver(volumeChanged, new IntentFilter(VOLUME_CHANGED));
        registerReceiver(screenOff, new IntentFilter(Intent.ACTION_SCREEN_OFF));
        guard.post(this::loadSnapshot);
        watcher = new Thread(this::watchHomeButton, "home button");
        watcher.setDaemon(true);
        watcher.start();
    }

    private static Handler startThread() {
        HandlerThread t = new HandlerThread("guard", Process.THREAD_PRIORITY_DISPLAY);
        t.start();
        return new Handler(t.getLooper());
    }

    /** Turning the TV off ends Amazon home's pause too. */
    private final BroadcastReceiver screenOff = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            Prefs.resume(context);
        }
    };

    /** Fire OS starting Amazon's home for the Home button; our Amazon home tile starts it from our own uid. */
    private static boolean isHomeButton(String line) {
        return line.contains("START u0 ") && line.contains("android.intent.category.HOME")
                && line.contains(AMAZON_LAUNCHER) && line.contains("from uid 1000");
    }

    private void watchHomeButton() {
        while (!Thread.currentThread().isInterrupted()) {
            // install-launcher.sh grants READ_LOGS after installing, so after an install this waits for it.
            if (checkSelfPermission(android.Manifest.permission.READ_LOGS) == PackageManager.PERMISSION_GRANTED) readLog();
            try {
                Thread.sleep(LOGCAT_RESTART_MS);
            } catch (InterruptedException e) {
                return;
            }
        }
    }

    /** Runs until logcat quits. */
    private void readLog() {
        java.lang.Process p = null;
        try {
            // From now on only: older lines would be presses long gone.
            String since = String.format(Locale.US, "%.3f", System.currentTimeMillis() / 1000.0);
            p = Runtime.getRuntime().exec(new String[] {"logcat", "-T", since, "-s", "ActivityManager:I"});
            logcat = p;
            BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()));
            for (String line; (line = r.readLine()) != null; ) {
                if (isHomeButton(line)) guard.post(this::homePressed);
            }
        } catch (IOException ignored) {
        } finally {
            if (p != null) p.destroy();
        }
    }

    /** Fire OS is bringing up Amazon's home (or it's already in front): cover it before it draws. */
    private void homePressed() {
        Prefs.resume(this);
        amazonHomeFront = true;
        pressedAt = SystemClock.uptimeMillis();
        takeOver();
    }

    private void amazonHome(boolean front) {
        amazonHomeFront = front;
        if (!front) {
            guard.removeCallbacks(retry);
            cancelAlarm();
            removeCoverWindow();
            return;
        }
        // The press already took over; starting Home again would only make it redo its return.
        if (SystemClock.uptimeMillis() - pressedAt < PRESS_EVENT_MS) return;
        if (!Prefs.isPaused(this)) takeOver();
    }

    private void takeOver() {
        showCover();
        MainActivity.landHome();
        openHome();
        retryUntil = System.currentTimeMillis() + GIVE_UP_MS;
        guard.removeCallbacks(retry);
        guard.postDelayed(retry, RETRY_MS);
    }

    /** Called by MainActivity, off the main thread, after it saves a new snapshot. */
    static void snapshotSaved() {
        HomeGuard g = instance;
        if (g != null) g.loadSnapshot();
    }

    private void loadSnapshot() {
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inPreferredConfig = Bitmap.Config.RGB_565;
        Bitmap b = BitmapFactory.decodeFile(new File(getFilesDir(), SNAPSHOT).getPath(), o);
        if (b != null) snapshot = b;
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
        guard.removeCallbacksAndMessages(null);
        guard.post(this::removeCover);
        guard.post(this::removeCoverWindow);
        guard.getLooper().quitSafely();
        try {
            unregisterReceiver(volumeChanged);
        } catch (IllegalArgumentException ignored) {
        }
        try {
            unregisterReceiver(screenOff);
        } catch (IllegalArgumentException ignored) {
        }
        if (watcher != null) watcher.interrupt();
        if (logcat != null) logcat.destroy();
        if (volume != null) volume.remove();
        if (instance == this) instance = null;
        super.onDestroy();
    }

    /** Called by MainActivity once it's in front. */
    static void homeShown() {
        HomeGuard g = instance;
        if (g == null) return;
        g.guard.post(() -> {
            g.shownAt = SystemClock.uptimeMillis();
            g.amazonHomeFront = false;
            g.guard.removeCallbacks(g.retry);
            g.cancelAlarm();
            g.guard.removeCallbacks(g.uncover);
            g.guard.postDelayed(g.uncover, UNCOVER_FALLBACK_MS);
            g.addCoverWindow();
        });
    }

    /**
     * Called by MainActivity once Home has drawn itself again. Dropping the cover when it merely
     * resumed showed a black or half-drawn frame, and with fast presses Amazon's home.
     */
    static void homeDrawn() {
        HomeGuard g = instance;
        if (g == null) return;
        g.guard.post(() -> {
            g.guard.removeCallbacks(g.uncover);
            g.guard.postDelayed(g.uncover, UNCOVER_DELAY_MS);
        });
    }

    /**
     * Only once Home came back after the cover went up, and while it's still in front: with fast
     * presses, word that Home had drawn could arrive after the next press and bare that one.
     */
    private void uncover() {
        if (!homeBack()) return;
        long wait = coveredAt + HOLD_AFTER_PRESS_MS - SystemClock.uptimeMillis();
        if (wait > 0) guard.postDelayed(uncover, wait);
        else removeCover();
    }

    /** The cover now sits over Griffin Home itself, not Amazon's. */
    private boolean homeBack() {
        return shownAt > coveredAt && MainActivity.inFront();
    }

    @Override
    protected boolean onKeyEvent(KeyEvent event) {
        if (covering) {
            // Only holding on over Home after a press: let the key through and show Home for it.
            if (event.getKeyCode() != KeyEvent.KEYCODE_HOME && homeBack()) {
                guard.post(removeCover);
                return false;
            }
            return true; // covering Amazon's home: don't let presses reach it
        }
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
        boolean front = AMAZON_LAUNCHER.equals(pkg)
                && String.valueOf(event.getClassName()).contains("HomeActivity");
        guard.post(() -> amazonHome(front));
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
        startActivity(homeIntent());
        guard.postDelayed(retry, RETRY_MS);
    }

    /**
     * Android holds our own start back until 5s after the last Home press, so each extra press kept
     * the cover (and the remote) frozen longer. An alarm's start comes from the system, which that
     * hold lets through. Fire OS puts an alarm due now 5s out, but drops that whenever it rebuilds
     * its alarm list, which cancelling any alarm does: so we set one and cancel a dummy, and Griffin
     * Home is back ~150ms after the press. retry() adds a plain start in case that ever fails.
     */
    private void openHome() {
        AlarmManager am = alarms();
        long now = SystemClock.elapsedRealtime();
        am.setExact(AlarmManager.ELAPSED_REALTIME, now, homeAlarm());
        PendingIntent nudge = PendingIntent.getBroadcast(this, 0,
                new Intent(ACTION_NUDGE).setPackage(getPackageName()), PendingIntent.FLAG_UPDATE_CURRENT);
        am.set(AlarmManager.ELAPSED_REALTIME, now + NUDGE_MS, nudge);
        am.cancel(nudge);
    }

    private Intent homeIntent() {
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return i;
    }

    private PendingIntent homeAlarm() {
        return PendingIntent.getActivity(this, 0, homeIntent(), PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private AlarmManager alarms() {
        return (AlarmManager) getSystemService(ALARM_SERVICE);
    }

    /** So an alarm still pending never pulls Griffin Home over whatever is up by then. */
    private void cancelAlarm() {
        alarms().cancel(homeAlarm());
    }

    private void showCover() {
        guard.removeCallbacks(uncover);
        guard.removeCallbacks(removeCover);
        guard.postDelayed(removeCover, COVER_TIMEOUT_MS);
        // Every press, so the cover waits for Home to come back from this one and holds on after it.
        coveredAt = SystemClock.uptimeMillis();
        if (covering || !addCoverWindow()) return;
        if (snapshot != null && snapshot != coverShows) {
            cover.setImageBitmap(snapshot);
            coverShows = snapshot;
        }
        cover.setAlpha(1f);
        covering = true;
    }

    private void removeCover() {
        guard.removeCallbacks(uncover);
        guard.removeCallbacks(removeCover);
        if (!covering) return;
        covering = false;
        cover.setAlpha(0f);
        if (!MainActivity.inFront()) removeCoverWindow();
    }

    /**
     * The cover's window, see-through until a press. Adding it waits on the window manager, which
     * right after Home comes back is busy enough that it took up to 300ms and Amazon's home showed;
     * so it stays up while Home is in front, and a press only has to draw the picture.
     */
    private boolean addCoverWindow() {
        if (coverWindow != null) return true;
        FrameLayout w = new FrameLayout(this);
        ImageView v = new ImageView(this);
        v.setBackgroundColor(Color.parseColor("#0B0B0C"));
        v.setScaleType(ImageView.ScaleType.FIT_XY);
        v.setAlpha(0f);
        w.addView(v);
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_FULLSCREEN
                        // A service's windows draw in software otherwise, which held the picture back ~400ms.
                        | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT);
        try {
            ((WindowManager) getSystemService(WINDOW_SERVICE)).addView(w, lp);
        } catch (RuntimeException e) {
            return false;
        }
        coverWindow = w;
        cover = v;
        return true;
    }

    /** Once another app is in front, so nothing extra sits over it. */
    private void removeCoverWindow() {
        if (coverWindow == null || covering) return;
        try {
            ((WindowManager) getSystemService(WINDOW_SERVICE)).removeView(coverWindow);
        } catch (RuntimeException ignored) {
        }
        coverWindow = null;
        cover = null;
        coverShows = null;
    }

    @Override
    public void onInterrupt() {}
}
