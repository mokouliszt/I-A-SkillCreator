package jp.mokouliszt.iaskillcreator;

import android.content.Context;
import android.webkit.WebResourceResponse;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Serves files from assets/www over a virtual https origin.
 *
 * Necessary because the Vite bundle uses <script type="module">, and ES modules
 * are blocked by CORS when loaded from a file:// (opaque) origin - the page would
 * render blank. A synthetic https origin gives the module loader a real origin.
 */
public class AssetServer {

    public static final String HOST = "appassets.androidplatform.net";
    public static final String BASE = "https://" + HOST + "/";

    private static final Map<String, String> MIME = new HashMap<>();

    static {
        MIME.put("html", "text/html");
        MIME.put("js", "application/javascript");
        MIME.put("mjs", "application/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("webp", "image/webp");
        MIME.put("ico", "image/x-icon");
        MIME.put("woff", "font/woff");
        MIME.put("woff2", "font/woff2");
        MIME.put("ttf", "font/ttf");
        MIME.put("map", "application/json");
    }

    private final Context ctx;

    public AssetServer(Context ctx) {
        this.ctx = ctx;
    }

    /** @return a response for in-app asset URLs, or null to let the network handle it. */
    public WebResourceResponse serve(String url) {
        if (url == null || !url.startsWith(BASE)) return null;

        String path = url.substring(BASE.length());
        int cut = path.indexOf('?');
        if (cut >= 0) path = path.substring(0, cut);
        cut = path.indexOf('#');
        if (cut >= 0) path = path.substring(0, cut);
        if (path.isEmpty() || path.endsWith("/")) path = path + "index.html";
        if (path.contains("..")) return null;

        try {
            InputStream in = ctx.getAssets().open("www/" + path);
            String mime = MIME.get(ext(path));
            if (mime == null) mime = "application/octet-stream";
            WebResourceResponse res = new WebResourceResponse(mime, "UTF-8", in);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            res.setResponseHeaders(headers);
            return res;
        } catch (Exception e) {
            // SPA fallback: unknown path -> index.html
            try {
                InputStream in = ctx.getAssets().open("www/index.html");
                return new WebResourceResponse("text/html", "UTF-8", in);
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    private static String ext(String path) {
        int i = path.lastIndexOf('.');
        return i < 0 ? "" : path.substring(i + 1).toLowerCase();
    }
}
