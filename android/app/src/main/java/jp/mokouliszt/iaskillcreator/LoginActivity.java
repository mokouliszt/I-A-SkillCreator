package jp.mokouliszt.iaskillcreator;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import java.util.LinkedHashMap;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Opens the real login page. The user signs in normally; when they tap 完了
 * the session cookies for the site's domains are read out of the WebView.
 */
public class LoginActivity extends AppCompatActivity {

    public static final String EXTRA_SITE_ID = "siteId";
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_DOMAINS = "domains";
    public static final String EXTRA_PATHS = "paths";
    public static final String EXTRA_AUTH_JSON = "authJson";

    private static final long DEFAULT_TTL_MS = 30L * 24 * 60 * 60 * 1000;

    private WebView web;
    private String siteId;
    private JSONArray domains = new JSONArray();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        siteId = getIntent().getStringExtra(EXTRA_SITE_ID);
        String url = getIntent().getStringExtra(EXTRA_URL);
        try {
            domains = new JSONArray(getIntent().getStringExtra(EXTRA_DOMAINS));
        } catch (Exception ignored) {
        }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#191817"));
        root.setFitsSystemWindows(true);

        LinearLayout hintBar = new LinearLayout(this);
        hintBar.setOrientation(LinearLayout.VERTICAL);
        hintBar.setBackgroundColor(Color.parseColor("#232220"));
        hintBar.setPadding(44, 32, 44, 32);

        TextView title = new TextView(this);
        title.setText("ログインすると認証情報を取り込みます");
        title.setTextColor(Color.parseColor("#F5F4EF"));
        title.setTextSize(14);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        hintBar.addView(title);

        TextView hint = new TextView(this);
        hint.setText("いつも通りログインし、右上の「完了」を押してください。"
                + "アプリに戻ると、この画面のログインセッション（Cookie）を回収します。"
                + "それを埋め込むことで、Claudeが同じログイン状態でマニュアルを読めるSkillになります。"
                + "ID・パスワードは保存しません。");
        hint.setTextColor(Color.parseColor("#A5A29A"));
        hint.setTextSize(12);
        hint.setLineSpacing(6f, 1f);
        hint.setPadding(0, 10, 0, 0);
        hintBar.addView(hint);

        root.addView(hintBar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        web = new WebView(this);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        web.setWebViewClient(new WebViewClient());

        root.addView(web, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setTitle("ログイン");
            getSupportActionBar().setSubtitle(siteId);
        }

        web.loadUrl(url);
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(Menu.NONE, 1, Menu.NONE, "完了")
                .setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == 1) {
            finishWithCookies();
            return true;
        }
        if (item.getItemId() == android.R.id.home) {
            setResult(Activity.RESULT_CANCELED, resultIntent());
            finish();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private Intent resultIntent() {
        Intent out = new Intent();
        out.putExtra(EXTRA_SITE_ID, siteId);
        return out;
    }

    private void finishWithCookies() {
        CookieManager cm = CookieManager.getInstance();
        cm.flush();

        // Cookies are path-scoped. Some sites run separate webapps per path
        // (KEYENCE issues a distinct JSESSIONID for /mypage/ and /download/),
        // so querying only "/" silently loses the session for those areas.
        JSONArray paths = new JSONArray();
        try {
            String raw = getIntent().getStringExtra(EXTRA_PATHS);
            if (raw != null) paths = new JSONArray(raw);
        } catch (Exception ignored) {
        }
        if (paths.length() == 0) paths.put("/");

        // key: domain|name|value -> keep the shortest (most general) path
        LinkedHashMap<String, JSONObject> picked = new LinkedHashMap<>();
        try {
            for (int i = 0; i < domains.length(); i++) {
                String domain = domains.getString(i);
                for (int p = 0; p < paths.length(); p++) {
                    String path = paths.getString(p);
                    String raw = cm.getCookie("https://" + domain + path);
                    if (raw == null) continue;
                    for (String pair : raw.split(";")) {
                        int eq = pair.indexOf('=');
                        if (eq <= 0) continue;
                        String name = pair.substring(0, eq).trim();
                        String value = pair.substring(eq + 1).trim();
                        String key = domain + "|" + name + "|" + value;
                        JSONObject prev = picked.get(key);
                        if (prev != null
                                && prev.optString("path", "/").length() <= path.length()) {
                            continue;
                        }
                        JSONObject c = new JSONObject();
                        c.put("name", name);
                        c.put("value", value);
                        c.put("domain", domain);
                        c.put("path", path);
                        picked.put(key, c);
                    }
                }
            }
        } catch (Exception ignored) {
        }

        JSONArray cookies = new JSONArray();
        for (JSONObject c : picked.values()) cookies.put(c);

        JSONObject auth = new JSONObject();
        try {
            auth.put("siteId", siteId);
            auth.put("cookies", cookies);
            auth.put("userAgent", web.getSettings().getUserAgentString());
            auth.put("capturedAt", System.currentTimeMillis());
            auth.put("expiresAt", System.currentTimeMillis() + DEFAULT_TTL_MS);
            auth.put("domains", domains);
        } catch (Exception ignored) {
        }

        Intent out = resultIntent();
        out.putExtra(EXTRA_AUTH_JSON, auth.toString());
        setResult(cookies.length() > 0 ? Activity.RESULT_OK : Activity.RESULT_CANCELED, out);
        finish();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else {
            setResult(Activity.RESULT_CANCELED, resultIntent());
            super.onBackPressed();
        }
    }
}
