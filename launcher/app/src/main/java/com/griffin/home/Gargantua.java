package com.griffin.home;

import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.service.dreams.DreamService;
import android.view.Gravity;
import android.widget.FrameLayout;
import android.widget.VideoView;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/**
 * Screensaver: Interstellar's Gargantua with a terminal readout of the date and Chicago weather,
 * alternating with 4K Apple aerials and film stills that scripts/stills.sh pushes to the TV.
 *
 * Aerials play in a native VideoView (hardware HEVC, full 4K) under a transparent WebView,
 * because the WebView can't decode Apple's HEVC .mov files.
 */
public class Gargantua extends DreamService {
    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView web;
    private VideoView video;

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(false); // any remote press wakes the TV
        setFullscreen(true);
        setScreenBright(true);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        video = new VideoView(this);
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
        root.addView(video, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT, Gravity.CENTER));

        web = new WebView(this);
        web.setBackgroundColor(Color.TRANSPARENT);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowFileAccessFromFileURLs(true); // stills are file:// images outside the assets
        web.addJavascriptInterface(new Media("stills", ".jpg"), "Stills");
        web.addJavascriptInterface(new Media("aerials", ".mov"), "Aerials");
        web.loadUrl("file:///android_asset/screensaver.html");
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
    }

    private void js(final String code) {
        main.post(() -> { if (web != null) web.evaluateJavascript(code, null); });
    }

    @Override
    public void onDetachedFromWindow() {
        if (video != null) {
            video.stopPlayback();
            video = null;
        }
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDetachedFromWindow();
    }

    /**
     * Exposed to screensaver.html as window.Stills (.jpg) and window.Aerials (.mov): files in
     * <external files>/<folder>, with titles from <folder>.json when scripts/stills.sh wrote one.
     */
    class Media {
        private final String folder, ext;

        Media(String folder, String ext) {
            this.folder = folder;
            this.ext = ext;
        }

        private File dir() {
            return getExternalFilesDir(folder);
        }

        /** [{src, name, title, kind}] */
        @JavascriptInterface
        public String list() {
            JSONArray out = new JSONArray();
            File dir = dir();
            File[] files = dir == null ? null : dir.listFiles((d, n) -> n.toLowerCase().endsWith(ext));
            if (files == null) return out.toString();
            Map<String, JSONObject> meta = readMeta(new File(dir, folder + ".json"));
            Arrays.sort(files);
            try {
                for (File f : files) {
                    JSONObject m = meta.get(f.getName());
                    String title = m != null ? m.optString("title")
                            : f.getName().replaceAll("(-\\d+)?\\.[a-z0-9]+$", "").replace('-', ' ');
                    out.put(new JSONObject()
                            .put("src", "file://" + f.getAbsolutePath())
                            .put("name", f.getName())
                            .put("title", title)
                            .put("kind", m != null ? m.optString("kind") : ""));
                }
            } catch (Exception ignored) {
            }
            return out.toString();
        }

        /** Aerials only: start the video under the page; JS hears saver.videoStarted() when it's on screen. */
        @JavascriptInterface
        public boolean play(String name) {
            final File f = new File(dir(), name);
            if (!f.exists() || name.contains("/")) return false;
            main.post(() -> { if (video != null) video.setVideoPath(f.getAbsolutePath()); });
            return true;
        }

        @JavascriptInterface
        public void stop() {
            main.post(() -> { if (video != null) video.stopPlayback(); });
        }
    }

    private static Map<String, JSONObject> readMeta(File json) {
        Map<String, JSONObject> meta = new HashMap<>();
        if (!json.exists()) return meta;
        try (FileInputStream in = new FileInputStream(json)) {
            byte[] buf = new byte[(int) json.length()];
            int n = 0;
            while (n < buf.length) {
                int r = in.read(buf, n, buf.length - n);
                if (r < 0) break;
                n += r;
            }
            JSONArray a = new JSONArray(new String(buf, 0, n, "UTF-8"));
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i);
                meta.put(o.getString("file"), o);
            }
        } catch (Exception ignored) {
        }
        return meta;
    }
}
