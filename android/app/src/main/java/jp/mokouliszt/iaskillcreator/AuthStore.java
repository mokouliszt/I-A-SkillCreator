package jp.mokouliszt.iaskillcreator;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.util.Map;

/** App-private storage for captured auth records, keyed by site id. */
public class AuthStore {

    private final SharedPreferences prefs;

    public AuthStore(Context ctx) {
        prefs = ctx.getSharedPreferences("fa_auth", Context.MODE_PRIVATE);
    }

    public void save(String siteId, String json) {
        if (siteId == null || json == null) return;
        prefs.edit().putString(siteId, json).apply();
    }

    public String get(String siteId) {
        return prefs.getString(siteId, null);
    }

    public void clear(String siteId) {
        prefs.edit().remove(siteId).apply();
    }

    /** @return {siteId: authRecord} with cookie values and passwords stripped out. */
    public String listRedacted() {
        JSONObject out = new JSONObject();
        for (Map.Entry<String, ?> e : prefs.getAll().entrySet()) {
            try {
                JSONObject rec = new JSONObject(String.valueOf(e.getValue()));

                // shared-password records: never hand the secret back to the WebView
                if (rec.has("password")) {
                    String pw = rec.optString("password", "");
                    rec.remove("password");
                    rec.put("hasPassword", pw.length() > 0);
                }

                org.json.JSONArray src = rec.optJSONArray("cookies");
                org.json.JSONArray safe = new org.json.JSONArray();
                if (src != null) {
                    for (int i = 0; i < src.length(); i++) {
                        JSONObject c = src.getJSONObject(i);
                        JSONObject s = new JSONObject();
                        s.put("name", c.optString("name"));
                        s.put("domain", c.optString("domain"));
                        safe.put(s);
                    }
                    rec.put("cookies", safe);
                }
                out.put(e.getKey(), rec);
            } catch (Exception ignored) {
            }
        }
        return out.toString();
    }

    /** Stores a site's shared download password (JTEKT-style gates). */
    public void savePassword(String siteId, String password) {
        if (siteId == null) return;
        try {
            JSONObject rec = new JSONObject();
            rec.put("siteId", siteId);
            rec.put("authType", "shared_password");
            rec.put("password", password == null ? "" : password);
            rec.put("capturedAt", System.currentTimeMillis());
            prefs.edit().putString(siteId, rec.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    /** @return the stored shared password, or empty string when unset. */
    public String getPassword(String siteId) {
        String raw = prefs.getString(siteId, null);
        if (raw == null) return "";
        try {
            return new JSONObject(raw).optString("password", "");
        } catch (Exception e) {
            return "";
        }
    }
}
