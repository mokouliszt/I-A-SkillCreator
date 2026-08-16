package jp.mokouliszt.iaskillcreator;

import android.webkit.JavascriptInterface;


import org.json.JSONObject;


/** Bridge exposed to the React UI as window.FaBridge. */
public class FaBridge {

    private final MainActivity activity;

    public FaBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public String listAuth() {
        return activity.getStore().listRedacted();
    }

    @JavascriptInterface
    public void openLogin(String siteId, String url, String domainsJson, String pathsJson) {
        activity.startLogin(siteId, url, domainsJson, pathsJson);
    }

    @JavascriptInterface
    public void clearAuth(String siteId) {
        activity.getStore().clear(siteId);
    }

    @JavascriptInterface
    public void setSharedPassword(String siteId, String password) {
        activity.getStore().savePassword(siteId, password);
    }

    @JavascriptInterface
    public void exportSkill(String configJson) {
        try {
            JSONObject config = new JSONObject(configJson);
            activity.startExport(config);
        } catch (Exception e) {
            activity.dispatch("faauth:error",
                    "{\"message\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}");
        }
    }
}
