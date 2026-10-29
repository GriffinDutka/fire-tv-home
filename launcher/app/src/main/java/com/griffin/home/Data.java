package com.griffin.home;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * window.Data in Home and the screensaver: live data the pages can't get themselves.
 * The pages load from file://, so most sites (news feeds, calendar links) refuse them over CORS;
 * Java has no such limit. Register with: web.addJavascriptInterface(new Data(this, web), "Data")
 */
class Data {
    private static final int MAX_BYTES = 8 * 1024 * 1024;
    private static final int MAX_REDIRECTS = 5;
    private static final Pattern CHARSET = Pattern.compile("charset=\"?([\\w.:-]+)", Pattern.CASE_INSENSITIVE);

    // A few fetches at once is plenty: a refresh is ~12 feeds plus the calendars.
    private static final ExecutorService POOL = Executors.newFixedThreadPool(4);

    private final Context context;
    private final WebView web;

    Data(Context context, WebView web) {
        this.context = context.getApplicationContext();
        this.web = web;
    }

    /** Fetched off the UI thread; the page hears data.done(id, text) or data.fail(id). */
    @JavascriptInterface
    public void fetch(final String id, final String url) {
        POOL.execute(() -> {
            try {
                String body = get(url);
                js("window.data && data.done(" + JSONObject.quote(id) + "," + JSONObject.quote(body) + ")");
            } catch (Exception e) {
                js("window.data && data.fail(" + JSONObject.quote(id) + ")");
            }
        });
    }

    /** 0 offline, 1–3 Wi-Fi strength, 4 Ethernet; -1 if Android won't say (permission missing). */
    @JavascriptInterface
    public int network() {
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo ni = cm.getActiveNetworkInfo();
            if (ni == null || !ni.isConnected()) return 0;
            if (ni.getType() == ConnectivityManager.TYPE_ETHERNET) return 4;
            if (ni.getType() != ConnectivityManager.TYPE_WIFI) return 3;
            WifiManager wm = (WifiManager) context.getSystemService(Context.WIFI_SERVICE);
            return WifiManager.calculateSignalLevel(wm.getConnectionInfo().getRssi(), 3) + 1;
        } catch (Exception e) {
            return -1;
        }
    }

    /** The Wi-Fi network's name, or "" when Android hides it (Android 9 needs location for this). */
    @JavascriptInterface
    public String wifiName() {
        try {
            WifiManager wm = (WifiManager) context.getSystemService(Context.WIFI_SERVICE);
            WifiInfo info = wm.getConnectionInfo();
            String ssid = info == null ? null : info.getSSID();
            if (ssid == null || ssid.equals("<unknown ssid>") || ssid.equals("0x")) return "";
            return ssid.replaceAll("^\"|\"$", "");
        } catch (Exception e) {
            return "";
        }
    }

    /** config/calendars.txt as pushed by scripts/calendar.sh ("Name|#color|url" lines), or "". */
    @JavascriptInterface
    public String calendars() {
        File dir = context.getExternalFilesDir("config");
        File f = dir == null ? null : new File(dir, "calendars.txt");
        if (f == null || !f.exists()) return "";
        try (FileInputStream in = new FileInputStream(f)) {
            return new String(readAll(in), "UTF-8");
        } catch (Exception e) {
            return "";
        }
    }

    private void js(final String code) {
        web.post(() -> web.evaluateJavascript(code, null));
    }

    /** GET as text. Follows redirects by hand, since HttpURLConnection won't hop http ↔ https. */
    private static String get(String url) throws IOException {
        if (url.startsWith("webcal://")) url = "https://" + url.substring(9);
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            c.setInstanceFollowRedirects(false);
            c.setRequestProperty("User-Agent", "GriffinHome/1.0");
            try {
                int code = c.getResponseCode();
                if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) {
                    url = new URL(new URL(url), c.getHeaderField("Location")).toString();
                    continue;
                }
                if (code < 200 || code >= 300) throw new IOException("HTTP " + code);
                try (InputStream in = c.getInputStream()) {
                    return new String(readAll(in), charset(c.getContentType()));
                }
            } finally {
                c.disconnect();
            }
        }
        throw new IOException("Too many redirects");
    }

    private static String charset(String contentType) {
        Matcher m = CHARSET.matcher(contentType == null ? "" : contentType);
        return m.find() ? m.group(1) : "UTF-8";
    }

    static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        for (int n; (n = in.read(buf)) > 0; ) {
            out.write(buf, 0, n);
            if (out.size() > MAX_BYTES) throw new IOException("Too big");
        }
        return out.toByteArray();
    }
}
