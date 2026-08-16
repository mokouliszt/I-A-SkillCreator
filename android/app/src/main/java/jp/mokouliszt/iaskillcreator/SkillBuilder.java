package jp.mokouliszt.iaskillcreator;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Packs SKILL.md + auth records + scripts into a .skill archive Claude can load. */
public class SkillBuilder {

    private final Context ctx;
    private final AuthStore store;

    public SkillBuilder(Context ctx, AuthStore store) {
        this.ctx = ctx;
        this.store = store;
    }

    /** Writes the skill archive (zip format) into {@code out}. Caller owns the stream. */
    public void writeTo(JSONObject config, OutputStream out) throws Exception {
        String name = config.optString("name", "industrial-auth-skill");
        String version = config.optString("version", "0.1.0");
        JSONArray sites = config.optJSONArray("sites");
        if (sites == null || sites.length() == 0) throw new Exception("no sites selected");

        StringBuilder names = new StringBuilder();
        StringBuilder table = new StringBuilder("| site | 名前 | tier | 入口 |\n| --- | --- | --- | --- |\n");

        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            for (int i = 0; i < sites.length(); i++) {
                JSONObject site = sites.getJSONObject(i);
                String id = site.getString("id");

                if (names.length() > 0) names.append("、");
                names.append(site.optString("name", id));

                String tier = site.optString("tier", "cookie");
                table.append("| `").append(id).append("` | ")
                        .append(site.optString("name", id)).append(" | `")
                        .append(tier).append("` | ")
                        .append(site.optString("entryUrl", "-")).append(" |\n");

                if ("password".equals(tier)) {
                    // shared-password sites: the password is entered by the user in
                    // the app and kept in app-private storage, never in source.
                    String pw = store.getPassword(id);
                    if (pw == null || pw.isEmpty()) {
                        throw new Exception("missing shared password for " + id);
                    }
                    JSONObject rec = new JSONObject();
                    rec.put("siteId", id);
                    rec.put("authType", "shared_password");
                    rec.put("password", pw);
                    rec.put("authEndpoint", site.optString("authEndpoint", ""));
                    putEntry(zip, name + "/auth/" + id + ".pw.json",
                            rec.toString().getBytes(StandardCharsets.UTF_8));
                } else {
                    String auth = store.get(id);
                    if (auth == null) throw new Exception("missing auth for " + id);
                    putEntry(zip, name + "/auth/" + id + ".json",
                            auth.getBytes(StandardCharsets.UTF_8));
                }
            }

            String skillMd = readAsset("skill/SKILL.md.tmpl")
                    .replace("{{NAME}}", name)
                    .replace("{{VERSION}}", version)
                    .replace("{{SITE_NAMES}}", names.toString())
                    .replace("{{SITE_TABLE}}", table.toString());

            putEntry(zip, name + "/SKILL.md", skillMd.getBytes(StandardCharsets.UTF_8));
            putEntry(zip, name + "/scripts/session.py", readAssetBytes("skill/scripts/session.py"));
            putEntry(zip, name + "/scripts/fetch.py", readAssetBytes("skill/scripts/fetch.py"));
        }
    }

    private void putEntry(ZipOutputStream zip, String path, byte[] data) throws Exception {
        zip.putNextEntry(new ZipEntry(path));
        zip.write(data);
        zip.closeEntry();
    }

    private byte[] readAssetBytes(String path) throws Exception {
        try (InputStream in = ctx.getAssets().open(path)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    private String readAsset(String path) throws Exception {
        return new String(readAssetBytes(path), StandardCharsets.UTF_8);
    }
}
