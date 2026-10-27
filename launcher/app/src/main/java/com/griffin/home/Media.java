package com.griffin.home;

import android.content.Context;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/**
 * Exposed to the pages as window.Stills (.jpg) and window.Aerials (.mov): files that
 * scripts/stills.sh pushed to <external files>/<folder>, with titles from <folder>.json.
 * The screensaver passes a Player so aerials can play; the home screen only lists.
 */
class Media {
    interface Player {
        void play(File f);
        void stop();
    }

    private final Context context;
    private final String folder, ext;
    private final Player player;

    Media(Context context, String folder, String ext, Player player) {
        this.context = context;
        this.folder = folder;
        this.ext = ext;
        this.player = player;
    }

    private File dir() {
        return context.getExternalFilesDir(folder);
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
        File f = new File(dir(), name);
        if (player == null || !f.exists() || name.contains("/")) return false;
        player.play(f);
        return true;
    }

    @JavascriptInterface
    public void stop() {
        if (player != null) player.stop();
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
