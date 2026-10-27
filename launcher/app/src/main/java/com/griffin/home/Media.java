package com.griffin.home;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

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
    private static final int THUMB_W = 480;
    private static final ExecutorService THUMBS = Executors.newSingleThreadExecutor();

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

    /**
     * A small JPEG (480 wide) of a still or an aerial, for the picture picker in Settings. Like
     * poster(): its file:// URL, or null while it's being made (one at a time, in the background).
     */
    @JavascriptInterface
    public String thumb(final String name) {
        final File f = new File(dir(), name);
        if (!f.exists() || name.contains("/")) return null;
        final File out = new File(context.getCacheDir(), "thumbs/" + folder + "/" + name + "-" + f.length() + ".jpg");
        if (out.exists()) return "file://" + out.getAbsolutePath();
        synchronized (MAKING) {
            if (!MAKING.add(out.getPath())) return null;
        }
        THUMBS.execute(() -> {
            Bitmap b = null, s = null;
            MediaMetadataRetriever r = null;
            try {
                out.getParentFile().mkdirs();
                if (".mov".equals(ext)) {
                    r = new MediaMetadataRetriever();
                    r.setDataSource(f.getAbsolutePath());
                    b = r.getFrameAtTime(POSTER_AT_US, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
                } else {
                    BitmapFactory.Options o = new BitmapFactory.Options();
                    o.inJustDecodeBounds = true;
                    BitmapFactory.decodeFile(f.getPath(), o);
                    o.inJustDecodeBounds = false;
                    o.inSampleSize = 1;
                    while (o.outWidth / (o.inSampleSize * 2) >= THUMB_W) o.inSampleSize *= 2;
                    b = BitmapFactory.decodeFile(f.getPath(), o);
                }
                if (b == null) return;
                s = Bitmap.createScaledBitmap(b, THUMB_W, THUMB_W * b.getHeight() / b.getWidth(), true);
                File tmp = new File(out.getPath() + ".tmp");
                try (FileOutputStream o = new FileOutputStream(tmp)) {
                    s.compress(Bitmap.CompressFormat.JPEG, 82, o);
                }
                tmp.renameTo(out);
            } catch (Exception | OutOfMemoryError ignored) {
            } finally {
                if (s != null && s != b) s.recycle();
                if (b != null) b.recycle();
                if (r != null) try { r.release(); } catch (Exception ignored) { }
                synchronized (MAKING) { MAKING.remove(out.getPath()); }
            }
        });
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
