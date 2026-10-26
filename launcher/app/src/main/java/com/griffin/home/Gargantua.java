package com.griffin.home;

import android.graphics.Color;
import android.service.dreams.DreamService;
import android.webkit.WebSettings;
import android.webkit.WebView;

/** Screensaver: Interstellar's Gargantua with a terminal readout of the date and Chicago weather. */
public class Gargantua extends DreamService {
    private WebView web;

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(false); // any remote press wakes the TV
        setFullscreen(true);
        setScreenBright(true);
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        web.loadUrl("file:///android_asset/screensaver.html");
        setContentView(web);
    }

    @Override
    public void onDetachedFromWindow() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDetachedFromWindow();
    }
}
