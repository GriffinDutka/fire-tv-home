package com.griffin.home;

import android.content.Context;
import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

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

    private static final long POSTER_AT_US = 20 * 1000 * 1000;
    private static final Set<String> MAKING = new HashSet<>();

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

    /** [{src, name, title, kind, listed}]. listed: named in <folder>.json (film stills are; your own pictures aren't). */
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
                        .put("kind", m != null ? m.optString("kind") : "")
                        .put("listed", m != null));
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

    /**
     * Aerials only: a still frame of the clip as a JPEG, so Home can show the aerial the screensaver
     * was playing (the WebView can't decode the video). Returns its file:// URL, or null while it's
     * still being made in the background; ask again in a few seconds.
     */
    @JavascriptInterface
    public String poster(final String name) {
        final File f = new File(dir(), name);
        if (!f.exists() || name.contains("/")) return null;
        final File out = new File(context.getCacheDir(), "posters/" + name + "-" + f.length() + ".jpg");
        if (out.exists()) return "file://" + out.getAbsolutePath();
        synchronized (MAKING) {
            if (!MAKING.add(out.getName())) return null;
        }
        new Thread(() -> {
            MediaMetadataRetriever r = new MediaMetadataRetriever();
            try {
                out.getParentFile().mkdirs();
                r.setDataSource(f.getAbsolutePath());
                Bitmap b = r.getFrameAtTime(POSTER_AT_US, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
                if (b == null) return;
                Bitmap s = Bitmap.createScaledBitmap(b, 1920, 1920 * b.getHeight() / b.getWidth(), true);
                File tmp = new File(out.getPath() + ".tmp");
                try (FileOutputStream o = new FileOutputStream(tmp)) {
                    s.compress(Bitmap.CompressFormat.JPEG, 88, o);
                }
                tmp.renameTo(out);
                if (s != b) s.recycle();
                b.recycle();
            } catch (Exception | OutOfMemoryError ignored) {
            } finally {
                try { r.release(); } catch (Exception ignored) { }
                synchronized (MAKING) { MAKING.remove(out.getName()); }
            }
        }).start();
        return null;
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
