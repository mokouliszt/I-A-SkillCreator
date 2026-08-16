package jp.mokouliszt.iaskillcreator;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.view.View;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

import java.io.OutputStream;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private AuthStore store;
    private JSONObject pendingExportConfig;

    private ActivityResultLauncher<Intent> loginLauncher;
    private ActivityResultLauncher<String> exportLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        store = new AuthStore(this);

        loginLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    String siteId = result.getData() != null
                            ? result.getData().getStringExtra(LoginActivity.EXTRA_SITE_ID)
                            : null;
                    if (result.getResultCode() == Activity.RESULT_OK && siteId != null) {
                        String payload = result.getData().getStringExtra(LoginActivity.EXTRA_AUTH_JSON);
                        store.save(siteId, payload);
                    }
                    notifyCaptured(siteId);
                });

        exportLauncher = registerForActivityResult(
                new ActivityResultContracts.CreateDocument("application/octet-stream"),
                uri -> {
                    JSONObject config = pendingExportConfig;
                    pendingExportConfig = null;
                    if (uri == null || config == null) {
                        dispatch("faauth:export-cancelled", "{}");
                        return;
                    }
                    writeSkillTo(uri, config);
                });

        webView = new WebView(this);
        setContentView(webView);

        final AssetServer assets = new AssetServer(this);

        webView.setBackgroundColor(0xFF191817);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        WebView.setWebContentsDebuggingEnabled(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                WebResourceResponse res = assets.serve(req.getUrl().toString());
                return res != null ? res : super.shouldInterceptRequest(view, req);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                // keep in-app navigation inside the asset origin only
                return !req.getUrl().toString().startsWith(AssetServer.BASE);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.d("IASkillCreator", m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });

        webView.addJavascriptInterface(new FaBridge(this), "FaBridge");
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        webView.loadUrl(AssetServer.BASE + "index.html");
    }

    /* ---- called from FaBridge (background thread) ---- */

    void startLogin(String siteId, String url, String domainsJson, String pathsJson) {
        runOnUiThread(() -> {
            Intent i = new Intent(this, LoginActivity.class);
            i.putExtra(LoginActivity.EXTRA_SITE_ID, siteId);
            i.putExtra(LoginActivity.EXTRA_URL, url);
            i.putExtra(LoginActivity.EXTRA_DOMAINS, domainsJson);
            i.putExtra(LoginActivity.EXTRA_PATHS, pathsJson);
            loginLauncher.launch(i);
        });
    }

    /** Opens the system file/folder picker so the user chooses where to save. */
    void startExport(JSONObject config) {
        runOnUiThread(() -> {
            pendingExportConfig = config;
            String name = config.optString("name", "industrial-auth-skill");
            exportLauncher.launch(name + ".skill");
        });
    }

    private void writeSkillTo(Uri uri, JSONObject config) {
        try (OutputStream out = getContentResolver().openOutputStream(uri, "w")) {
            if (out == null) throw new Exception("cannot open destination");
            new SkillBuilder(this, store).writeTo(config, out);
            String label = fileLabel(uri);
            dispatch("faauth:exported", "{\"path\":" + JSONObject.quote(label) + "}");
        } catch (Exception e) {
            dispatch("faauth:error",
                    "{\"message\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}");
        }
    }

    private String fileLabel(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) return c.getString(idx);
            }
        } catch (Exception ignored) {
        }
        return uri.getLastPathSegment();
    }

    AuthStore getStore() {
        return store;
    }

    private void notifyCaptured(String siteId) {
        dispatch("faauth:captured", "{\"siteId\":" + JSONObject.quote(siteId == null ? "" : siteId) + "}");
    }

    void dispatch(String event, String detailJson) {
        runOnUiThread(() -> webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent(" + JSONObject.quote(event)
                        + ",{detail:" + detailJson + "}));", null));
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
