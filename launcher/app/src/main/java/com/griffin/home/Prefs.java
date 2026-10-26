package com.griffin.home;

import android.content.Context;
import android.content.SharedPreferences;

final class Prefs {
    private static final String FILE = "griffin_home";
    private static final String PAUSED_UNTIL = "paused_until";

    private Prefs() {}

    private static SharedPreferences sp(Context c) {
        return c.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    /** Let Amazon's home stay up for a while (e.g. to switch inputs). */
    static void pauseFor(Context c, long millis) {
        sp(c).edit().putLong(PAUSED_UNTIL, System.currentTimeMillis() + millis).apply();
    }

    static void resume(Context c) {
        sp(c).edit().remove(PAUSED_UNTIL).apply();
    }

    static boolean isPaused(Context c) {
        return System.currentTimeMillis() < sp(c).getLong(PAUSED_UNTIL, 0);
    }
}
