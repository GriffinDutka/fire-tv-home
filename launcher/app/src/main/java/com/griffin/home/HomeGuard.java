package com.griffin.home;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityEvent;

/**
 * Makes the remote's Home button open Griffin Home.
 *
 * Primary path: swallow the Home key before Fire OS handles it, so Amazon's home never shows.
 * Fallback: if Amazon's home activity comes up anyway (boot, other entry points), swap ours in.
 */
public class HomeGuard extends AccessibilityService {
    static final String AMAZON_LAUNCHER = "com.amazon.tv.launcher";

    @Override
    protected boolean onKeyEvent(KeyEvent event) {
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
        openHome();
    }

    private void openHome() {
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        startActivity(i);
    }

    @Override
    public void onInterrupt() {}
}
