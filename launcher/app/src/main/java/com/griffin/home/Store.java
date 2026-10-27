package com.griffin.home;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;

/**
 * window.Store in both pages: JSON strings by key, shared by Home and the screensaver.
 * They're separate WebViews, so settings live here rather than in either page's localStorage.
 */
class Store {
    private final SharedPreferences sp;

    Store(Context c) {
        sp = c.getSharedPreferences("griffin_home", Context.MODE_PRIVATE);
    }

    @JavascriptInterface
    public String get(String key) {
        return sp.getString("ui." + key, null);
    }

    @JavascriptInterface
    public void set(String key, String json) {
        sp.edit().putString("ui." + key, json).apply();
    }
}
