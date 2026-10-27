package com.griffin.home;

import android.content.Context;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.VideoView;

import java.io.File;

/**
 * The screensaver itself, shared by the Gargantua DreamService and ScreensaverActivity
 * (which the home screen opens to start it on demand).
 *
 * Aerials play in a native VideoView (hardware HEVC, full 4K) under a transparent WebView,
 * because the WebView can't decode Apple's HEVC .mov files.
 */
class SaverView extends FrameLayout implements Media.Player {
    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView web;
    private VideoView video;

    SaverView(Context context) {
        super(context);
        setBackgroundColor(Color.BLACK);
        video = new VideoView(context);
        video.setOnPreparedListener(mp -> {
            mp.setVolume(0f, 0f);
            video.start();
            js("saver.videoStarted()");
        });
        video.setOnCompletionListener(mp -> js("saver.videoEnded()"));
        video.setOnErrorListener((mp, what, extra) -> {
            js("saver.videoEnded()");
            return true;
        });
        addView(video, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT, Gravity.CENTER));

        web = new WebView(context);
        web.setBackgroundColor(Color.TRANSPARENT);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowFileAccessFromFileURLs(true); // stills are file:// images outside the assets
        web.addJavascriptInterface(new Store(context), "Store");
        web.addJavascriptInterface(new Data(context, web), "Data");
        web.addJavascriptInterface(new Media(context, "stills", ".jpg", null), "Stills");
        web.addJavascriptInterface(new Media(context, "aerials", ".mov", this), "Aerials");
        web.setWebViewClient(new WebViewClient()); // keeps the Gargantua scene's iframe inside the page
        web.loadUrl("file:///android_asset/screensaver.html");
        addView(web, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));
    }

    private void js(final String code) {
        main.post(() -> { if (web != null) web.evaluateJavascript(code, null); });
    }

    @Override
    public void play(File f) {
        main.post(() -> { if (video != null) video.setVideoPath(f.getAbsolutePath()); });
    }

    @Override
    public void stop() {
        main.post(() -> { if (video != null) video.stopPlayback(); });
    }

    void destroy() {
        if (video != null) {
            video.stopPlayback();
            video = null;
        }
        if (web != null) {
            web.destroy();
            web = null;
        }
    }
}
