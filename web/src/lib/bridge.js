/**
 * Thin wrapper over the native JavascriptInterface (window.FaBridge).
 * Falls back to a browser mock so the UI can be developed with `npm run dev`.
 */

const native = typeof window !== "undefined" ? window.FaBridge : undefined;
export const isNative = !!native;

function parse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/* ---- mock state for browser dev ---- */
const mock = {
  mitsubishi: {
    cookies: [
      { name: "JSESSIONID", domain: "www.mitsubishielectric.co.jp" },
      { name: "fa_member_token", domain: "www.mitsubishielectric.co.jp" },
      { name: "b_login_state", domain: "dl.mitsubishielectric.co.jp" },
    ],
    userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
    capturedAt: Date.now() - 3 * 86400000,
    expiresAt: Date.now() + 27 * 86400000,
  },
  omron: {
    cookies: [
      { name: "iweb_session", domain: "www.fa.omron.co.jp" },
      { name: "dlc_agree", domain: "www.fa.omron.co.jp" },
    ],
    userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
    capturedAt: Date.now() - 32 * 86400000,
    expiresAt: Date.now() - 2 * 86400000,
  },
};

export const Bridge = {
  /** @returns {Record<string, object>} siteId -> auth record */
  listAuth() {
    if (!native) return { ...mock };
    return parse(native.listAuth(), {});
  },

  /** Opens the login WebView. Result arrives via the `faauth:captured` event. */
  openLogin(siteId, url, domains, paths) {
    if (!native) {
      setTimeout(() => {
        mock[siteId] = {
          cookies: domains.map((d, i) => ({ name: `session_${i}`, domain: d })),
          userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
          capturedAt: Date.now(),
          expiresAt: Date.now() + 30 * 86400000,
        };
        window.dispatchEvent(
          new CustomEvent("faauth:captured", { detail: { siteId } })
        );
      }, 1200);
      return;
    }
    native.openLogin(siteId, url, JSON.stringify(domains),
                     JSON.stringify(paths || ["/"]));
  },

  clearAuth(siteId) {
    if (!native) {
      delete mock[siteId];
      return;
    }
    native.clearAuth(siteId);
  },

  /** Stores a shared download password (JTEKT-style gates). */
  setSharedPassword(siteId, password) {
    if (!native) {
      if (password) {
        mock[siteId] = { hasPassword: true, capturedAt: Date.now() };
      } else {
        delete mock[siteId];
      }
      return;
    }
    native.setSharedPassword(siteId, password);
  },

  /** Writes the skill zip and opens the share sheet. */
  exportSkill(config) {
    if (!native) {
      window.dispatchEvent(
        new CustomEvent("faauth:exported", {
          detail: { path: `${config.name}.skill` },
        })
      );
      return;
    }
    native.exportSkill(JSON.stringify(config));
  },
};
