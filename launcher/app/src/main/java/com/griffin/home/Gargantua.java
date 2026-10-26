package com.griffin.home;

import android.graphics.Color;
import android.service.dreams.DreamService;
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
 * alternating with film stills that scripts/stills.sh pushes to the TV.
 */
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
        ws.setAllowFileAccessFromFileURLs(true); // stills are file:// images outside the assets
        web.addJavascriptInterface(new Stills(), "Stills");
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

    /** Exposed to screensaver.html as window.Stills. */
    class Stills {
        /** [{src, name, title}] for every .jpg in <external files>/stills; titles from stills.json. */
        @JavascriptInterface
        public String list() {
            JSONArray out = new JSONArray();
            File dir = getExternalFilesDir("stills");
            File[] files = dir == null ? null : dir.listFiles((d, n) -> n.toLowerCase().endsWith(".jpg"));
            if (files == null) return out.toString();
            Map<String, String> titles = readTitles(new File(dir, "stills.json"));
            Arrays.sort(files);
            try {
                for (File f : files) {
                    String title = titles.get(f.getName());
                    if (title == null) title = f.getName().replaceAll("(-\\d+)?\\.jpg$", "").replace('-', ' ');
                    out.put(new JSONObject()
                            .put("src", "file://" + f.getAbsolutePath())
                            .put("name", f.getName())
                            .put("title", title));
                }
            } catch (Exception ignored) {
            }
            return out.toString();
        }
    }

    private static Map<String, String> readTitles(File json) {
        Map<String, String> titles = new HashMap<>();
        if (!json.exists()) return titles;
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
                titles.put(o.getString("file"), o.getString("title"));
            }
        } catch (Exception ignored) {
        }
        return titles;
    }
}
