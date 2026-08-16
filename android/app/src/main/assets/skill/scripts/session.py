"""Session builders for FA manual sites captured/configured by FA Auth Bridge.

Two auth types:
  - cookie:          <site>.json     (cookies + userAgent, captured on device)
  - shared_password: <site>.pw.json  (a documented shared password + endpoint)
"""

import json
import os
import sys

AUTH_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "auth")

UA_FALLBACK = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
               "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")


class AuthExpired(Exception):
    pass


def _read(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_auth(site_id):
    """Return (kind, record). kind is 'cookie' or 'password'."""
    pw = os.path.join(AUTH_DIR, f"{site_id}.pw.json")
    ck = os.path.join(AUTH_DIR, f"{site_id}.json")
    if os.path.exists(pw):
        return "password", _read(pw)
    if os.path.exists(ck):
        rec = _read(ck)
        if not rec.get("cookies"):
            raise AuthExpired(f"auth record for '{site_id}' has no cookies")
        return "cookie", rec
    raise AuthExpired(f"no auth record for '{site_id}'")


def build_cookie_session(rec):
    import requests

    s = requests.Session()
    s.headers.update({
        "User-Agent": rec.get("userAgent") or UA_FALLBACK,
        "Accept-Language": "ja,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
    })
    for c in rec["cookies"]:
        s.cookies.set(c["name"], c["value"], domain=c.get("domain"), path=c.get("path", "/"))
    return s


def build_password_session(rec, target_url):
    """Fetch the target once to obtain the auth form + CSRF token, POST the shared
    password, and return a session already authorized for subsequent downloads.

    Mirrors the JTEKT flow: PDF -> getdata.php -> authdata.php (password form) ->
    POST password+token -> redirect back to the PDF; the session cookie is then
    flagged so any further PDF downloads succeed without re-auth.
    """
    import re
    import requests

    s = requests.Session()
    s.headers.update({
        "User-Agent": UA_FALLBACK,
        "Accept-Language": "ja,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
    })

    r = s.get(target_url, timeout=60, allow_redirects=True)
    # already a binary? then no gate was hit.
    if "text/html" not in r.headers.get("Content-Type", ""):
        return s, r

    form_url = str(r.url)
    if "authdata.php" not in form_url and "password" not in r.text:
        # no recognizable gate; hand back what we have
        return s, r

    token = None
    m = re.search(r'name="token"[^>]*value="([^"]+)"', r.text)
    if not m:
        m = re.search(r'value="([0-9a-f]{40})"[^>]*name="token"', r.text)
    if m:
        token = m.group(1)

    data = {"mode": "download", "password": rec.get("password", ""), "searchBtn": "Download"}
    if token:
        data["token"] = token

    pr = s.post(form_url, data=data, timeout=60, allow_redirects=True,
                headers={"Referer": form_url})
    if "text/html" in pr.headers.get("Content-Type", "") and "password" in pr.text:
        raise AuthExpired("shared password rejected (may have changed)")
    return s, None


LOGIN_MARKERS = (
    "b_login.php", "/view/login/", "ログイン | 三菱電機FA",
    "I-Webメンバーズにログイン", "authdata.php",
)


def looks_like_login(url, text):
    lowered = (url or "").lower()
    if any(m.lower() in lowered for m in LOGIN_MARKERS):
        return True
    head = (text or "")[:4000]
    return any(m in head for m in LOGIN_MARKERS)


def fail_expired(reason):
    print(f"\nAUTH_EXPIRED: {reason}", file=sys.stderr)
    print("AUTH_EXPIRED")
    sys.exit(2)
