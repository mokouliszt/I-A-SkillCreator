#!/usr/bin/env python3
"""Fetch a page or PDF from an FA site using a captured/configured session."""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from session import (  # noqa: E402
    load_auth, build_cookie_session, build_password_session,
    looks_like_login, fail_expired, AuthExpired,
)


def to_text(html):
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return html
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    lines = [ln.strip() for ln in soup.get_text("\n").splitlines()]
    return "\n".join(ln for ln in lines if ln)


def extract_links(html, base_url, pattern=None):
    """Return absolute links found on the page, optionally filtered by regex."""
    import re
    from urllib.parse import urljoin
    hrefs = re.findall(r'(?:href|src)=["\']([^"\']+)["\']', html, re.I)
    seen, out = set(), []
    for h in hrefs:
        u = urljoin(base_url, h.strip())
        if not u.lower().startswith("http"):
            continue
        if pattern and not re.search(pattern, u, re.I):
            continue
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def print_links(r, args):
    pattern = args.links if args.links not in (None, "", "all") else None
    links = extract_links(r.text, str(r.url), pattern)
    if not links:
        print("(該当するリンクなし)")
        return
    for u in links[: args.max_links]:
        print(u)
    if len(links) > args.max_links:
        print(f"... 他 {len(links) - args.max_links} 件")


def save_or_print(r, args):
    if args.links is not None:
        if looks_like_login(r.url, r.text):
            fail_expired(f"redirected to a login page ({r.url})")
        print_links(r, args)
        return
    ctype = r.headers.get("Content-Type", "")
    is_pdf = ("pdf" in ctype or "octet-stream" in ctype
              or args.url.lower().endswith(".pdf"))
    if is_pdf and args.out:
        with open(args.out, "wb") as f:
            f.write(r.content)
        print(f"saved: {args.out} ({len(r.content) / 1048576:.2f} MB)")
        return
    if is_pdf and not args.out:
        print("PDFです。--out で保存先を指定してください。", file=sys.stderr)
        sys.exit(1)
    if looks_like_login(r.url, r.text):
        fail_expired(f"redirected to a login page ({r.url})")
    print(to_text(r.text)[: args.limit])


def cookie_fetch(args, rec):
    s = build_cookie_session(rec)
    r = s.get(args.url, timeout=60, allow_redirects=True)
    save_or_print(r, args)


def password_fetch(args, rec):
    # authorize the session against the target, then GET it
    s, pre = build_password_session(rec, args.url)
    if pre is not None and ("pdf" in pre.headers.get("Content-Type", "")
                            or "octet-stream" in pre.headers.get("Content-Type", "")):
        save_or_print(pre, args)
        return
    r = s.get(args.url, timeout=90, allow_redirects=True)
    save_or_print(r, args)


def rendered_fetch(args, rec):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright が入っていません: pip install playwright && playwright install chromium",
              file=sys.stderr)
        sys.exit(1)
    cookies = [{
        "name": c["name"], "value": c["value"],
        "domain": c.get("domain"), "path": c.get("path", "/"),
    } for c in rec["cookies"]]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=[
            "--disable-blink-features=AutomationControlled",
        ] if args.stealth else [])
        ctx = browser.new_context(user_agent=rec.get("userAgent"), locale="ja-JP",
                                  ignore_https_errors=True,
                                  viewport={"width": 1280, "height": 2000})
        if args.stealth:
            ctx.add_init_script(
                "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")
        ctx.add_cookies(cookies)
        page = ctx.new_page()
        page.goto(args.url, wait_until="networkidle", timeout=90000)
        page.wait_for_timeout(args.wait)
        url, html = page.url, page.content()
        browser.close()
    if looks_like_login(url, html):
        fail_expired(f"redirected to a login page ({url})")
    print(to_text(html)[: args.limit])


OMRON_DOC_TYPE = {0: "データシート", 1: "カタログ", 2: "マニュアル",
                  3: "テクニカルガイド", 4: "ソフトウェア"}


def omron_docs(args, rec):
    """List documents for an OMRON product family via its JSON API.

    The download list on a product page is rendered by JS, so scraping the HTML
    returns nothing. This calls the same endpoint the page uses:
      GET /product_api/search/all_documents?site_id=14&product_ids=<familyId>
    PDF URLs are built as /data_pdf/mnu/<url1>?id=<familyId>.
    """
    import requests

    s = build_cookie_session(rec)
    r = s.get("https://www.fa.omron.co.jp/product_api/search/all_documents",
              params={"site_id": args.site_id, "product_ids": args.family},
              headers={"Accept": "application/json",
                       "X-Requested-With": "XMLHttpRequest"},
              timeout=60)
    if r.status_code != 200:
        fail_expired(f"document API returned {r.status_code}")
    try:
        data = r.json()
    except Exception:
        fail_expired("document API did not return JSON")

    docs = (data.get("data") or {}).get("docList") or []
    if not docs:
        print("(資料なし。--family の値を確認)")
        return

    rows, seen = [], set()
    for x in docs:
        d = x.get("doc") or {}
        if args.lang and d.get("language") != args.lang:
            continue
        key = d.get("documentId") or (d.get("url1"), d.get("documentName"))
        if key in seen:
            continue
        seen.add(key)
        rows.append(d)

    for d in rows:
        code = d.get("documentCode") or "-"
        kind = OMRON_DOC_TYPE.get(d.get("type"), str(d.get("type")))
        mb = (d.get("fileSize") or 0) / 1048576
        name = d.get("documentName") or ""
        url = d.get("url1")
        # ?id= must be the document's own family, not the whole query set
        fam = d.get("b5Id") or d.get("productId") or str(args.family).split(",")[0]
        full = (f"https://www.fa.omron.co.jp/data_pdf/mnu/{url}?id={fam}"
                if url else "-")
        print(f"{code}\t{kind}\t{mb:.1f}MB\t{name}\n\t{full}")
    print(f"\n{len(rows)} 件")


def _titles_near_assets(html_text):
    """Best-effort map assetID -> nearby document title for the older template."""
    import re
    out = {}
    for m in re.finditer(r'dlAssetId=(AS_\d+)', html_text):
        seg = html_text[max(0, m.start() - 1200):m.start()]
        cands = re.findall(r'>([^<>]{6,90}?)<', seg)
        cands = [c.strip() for c in cands if c.strip()
                 and "ダウンロード" not in c and "\n" not in c]
        if cands:
            out[m.group(1)] = cands[-1]
    return out


def _keyence_extract(html_text, lang):
    """Return [(assetID, title)] from either KEYENCE support-page template."""
    import html as _html
    import json as _json
    import re

    want = _keyence_lang(lang)
    m = re.search(r"var supportCards\s*=\s*(\{.*?\});\s*\n", html_text, re.S)
    if m:
        try:
            data = _json.loads(_html.unescape(m.group(1)))
        except Exception:
            return []
        out = []
        for c in data.get("cards") or []:
            if want and c.get("writtenLanguageID") != want:
                continue
            out.append((c.get("assetID") or "-", c.get("assetName") or ""))
        return out

    ids = _uniq(re.findall(r"dlAssetId=(AS_\d+)", html_text))
    if not ids:
        return []
    titles = _titles_near_assets(html_text)
    return [(a, titles.get(a, "")) for a in ids]


def _keyence_lang(v):
    return {"ja_JP": "ja-JP", "en_US": "en-GB"}.get(v, v)


def keyence_cards(args, rec):
    """List Keyence support-page documents.

    Manual cards are rendered by JS from a `var supportCards = {...}` blob that
    IS present in the page HTML, so scraping the rendered DOM is unnecessary and
    this works even when the login session has lapsed. Download links take the
    form /download/download/confirmation/?dlAssetId=<assetID>, which requires a
    live login.
    """
    import html as _html
    import json as _json
    import re

    s = build_cookie_session(rec)
    r = s.get(args.url, timeout=60)
    m = re.search(r"var supportCards\s*=\s*(\{.*?\});\s*\n", r.text, re.S)

    if not m:
        # Older template (e.g. IX series): the dlAssetId links sit in the HTML
        # directly, next to the document title.
        pairs = re.findall(
            r'href="[^"]*dlAssetId=(AS_\d+)"[^>]*>(?:(?!</a>).)*?</a>', r.text, re.S)
        ids = re.findall(r'dlAssetId=(AS_\d+)', r.text)
        seen, out = set(), []
        for a in ids:
            if a not in seen:
                seen.add(a)
                out.append(a)
        if not out:
            print("(このページに資料が見つかりません。URLを確認)")
            return
        titles = _titles_near_assets(r.text)
        for a in out:
            print(f"{a}\t-\t{titles.get(a, '')}")
            print(f"\thttps://www.keyence.co.jp/download/download/confirmation/?dlAssetId={a}")
        print(f"\n{len(out)} 件")
        print("※ 実ダウンロードはログイン必須。AUTH_EXPIRED の場合は再取得が要る。")
        return

    data = _json.loads(_html.unescape(m.group(1)))
    cards = data.get("cards") or []

    want = _keyence_lang(args.lang)
    rows = [c for c in cards
            if not want or c.get("writtenLanguageID") == want]
    if not rows:
        print(f"(言語 {want} の資料なし。--lang '' で全件)")
        return

    for c in rows:
        name = c.get("assetName") or ""
        aid = c.get("assetID") or "-"
        kind = c.get("objectType") or "-"
        print(f"{aid}\t{kind}\t{name}")
        print(f"\thttps://www.keyence.co.jp/download/download/confirmation/?dlAssetId={aid}")
    print(f"\n{len(rows)} 件")
    print("※ 実ダウンロードはログイン必須。AUTH_EXPIRED の場合は再取得が要る。")


# ---------------------------------------------------------------- search

JTEKT_SEARCH = {
    "plc": "OfcTpTorisetuList.php",
    "safety-plc": "OfcTpTorisetuList.php",
    "motion": "OfcMcTorisetuList.php",
    "hmi": "OfcHsTorisetuList.php",
    "software": "OfcTpTorisetuList.php",
}


def search_mitsubishi(args, rec):
    """Manual search across all Mitsubishi FA products.

    The cross-site search page delegates manual results to this same endpoint,
    so it covers every product line (PLC, servo, inverter, GOT, robot, ...).
    """
    import re
    from urllib.parse import quote, urljoin

    s = build_cookie_session(rec)
    url = ("https://www.mitsubishielectric.co.jp/fa/download/search.do"
           f"?mode=keymanual&q={quote(args.query)}&lang=1&sort=0")
    r = s.get(url, timeout=60)
    if looks_like_login(r.url, r.text):
        fail_expired(f"redirected to a login page ({r.url})")

    # split into result tiles so each title keeps its own PDF links
    tiles = re.split(r'<div class="l-tile__item"', r.text)[1:]
    total = 0
    for tile in tiles:
        mt = re.search(
            r'class="c-downloadResultList__itemTitle".*?<span>(.*?)</span>',
            tile, re.S)
        title = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", mt.group(1))).strip() if mt else ""
        pdfs = _uniq(re.findall(
            r'https://dl\.mitsubishielectric\.co\.jp[^\s"\'<>]*\.pdf', tile))
        if not pdfs:
            continue
        date = re.search(r'itemPublishDate">([^<]*)<', tile)
        head = title or "(無題)"
        if date:
            head += f"  [{date.group(1).strip()}]"
        print(head[:110])
        for pdf in pdfs:
            print(f"\t{pdf}")
            total += 1
    print(f"\n{len(tiles)} 資料 / {total} ファイル")


def search_jtekt(args, rec):
    """Manual search across JTEKT product categories."""
    import re
    from urllib.parse import quote

    cats = ([args.category] if args.category
            else ["plc", "motion", "hmi"])
    s = _plain_session(rec)
    total = 0
    for cat in cats:
        script = JTEKT_SEARCH.get(cat)
        if not script:
            print(f"(未知のカテゴリ: {cat})")
            continue
        url = (f"https://toyoda.jtekt.co.jp/support/{script}"
               f"?series_id=&q={quote(args.query)}&gengo=1&searchBtn=%E6%A4%9C%E7%B4%A2")
        try:
            r = s.get(url, timeout=60)
        except Exception as e:
            print(f"[{cat}] 取得失敗: {e}")
            continue
        pdfs = _uniq(re.findall(r'href="([^"]*/data/[^"]*\.pdf)"', r.text, re.I))
        if not pdfs:
            continue
        print(f"--- {cat} ---")
        for u in pdfs:
            if u.startswith("/"):
                u = "https://toyoda.jtekt.co.jp" + u
            print(f"\t{u}")
            total += 1
    print(f"\n{total} 件")


def search_omron(args, rec):
    """Keyword search across all OMRON products.

    Two hops: the search server maps a keyword to product family ids, then the
    document API returns that family's documents.
    """
    import re

    s = build_cookie_session(rec)
    r = s.get("https://search.fa.omron.co.jp/OEJ/", params={"q": args.query}, timeout=60)
    fams = _uniq(re.findall(r"/products/family/(\d+)/", r.text))[: args.max_families]
    if not fams:
        print("(該当する製品ファミリなし)")
        return
    print(f"# 製品ファミリ: {', '.join(fams)}\n")

    args.family = ",".join(fams)
    omron_docs(args, rec)


def keyence_download(args, rec):
    """Download a KEYENCE asset by assetID (AS_xxxxx).

    Three hops, mirroring what the browser does:
      1. GET  /download/download/confirmation/?dlAssetId=<id>   (Struts TOKEN)
      2. POST /mykeyence/                                       -> リクエスト画面
      3. GET  /mykeyence/downloadFromDLList?downloadAssetId=... -> the file

    The survey on the confirmation page belongs to a separate "詳しく知りたい方へ"
    section and is NOT part of the download; do not submit it.
    """
    import re

    s = build_cookie_session(rec)
    asset = args.asset
    conf = ("https://www.keyence.co.jp/download/download/confirmation/"
            f"?dlAssetId={asset}")
    r = s.get(conf, timeout=90)
    if "メールアドレスをご入力ください" in r.text:
        fail_expired("KEYENCE のログインセッションが切れている")

    m = re.search(r'<form[^>]*action="/mykeyence/"[^>]*>(.*?)</form>', r.text, re.S)
    if not m:
        fail_expired("ダウンロードフォームが見つからない（画面構成の変更か失効）")

    pairs = []
    for inp in re.finditer(r"<input[^>]*>", m.group(1)):
        tag = inp.group(0)
        n = re.search(r'name=["\']([^"\']+)["\']', tag)
        v = re.search(r'value=["\']([^"\']*)["\']', tag)
        if n:
            pairs.append((n.group(1), v.group(1) if v else ""))

    req = s.post("https://www.keyence.co.jp/mykeyence/", data=pairs,
                 headers={"Referer": conf}, timeout=300)
    link = re.search(r'href="(/mykeyence/downloadFromDLList[^"]*)"', req.text)
    if not link:
        print("ダウンロードリンクが出ませんでした。assetIDを確認してください。",
              file=sys.stderr)
        sys.exit(1)

    dl = "https://www.keyence.co.jp" + link.group(1).replace("&amp;", "&")
    resp = s.get(dl, headers={"Referer": "https://www.keyence.co.jp/mykeyence/"},
                 timeout=600)
    if resp.content[:4] != b"%PDF" and "pdf" not in \
            resp.headers.get("Content-Type", "").lower() and \
            "octet-stream" not in resp.headers.get("Content-Type", "").lower():
        fail_expired("ファイルが返らなかった（セッション失効の可能性）")

    out = args.out
    if not out:
        cd = resp.headers.get("Content-Disposition", "")
        fn = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", cd)
        out = fn.group(1) if fn else f"{asset}.pdf"
    with open(out, "wb") as f:
        f.write(resp.content)
    print(f"saved: {out} ({len(resp.content) / 1048576:.2f} MB)")


def search_keyence(args, rec):
    """Keyword search over KEYENCE support pages.

    The global search API returns nothing usable, so this walks the support
    series index (all product categories) and filters their document cards.
    """
    import re

    s = build_cookie_session(rec)
    r = s.get("https://www.keyence.co.jp/support/user/", timeout=60)
    series = _uniq(re.findall(r'href="(/support/user/[a-z0-9_\-/]+/)"', r.text))
    if args.category:
        series = [x for x in series if args.category in x]
    print(f"# 探索対象シリーズ {len(series)} 件\n")

    q = args.query.lower()
    total = 0
    for path in series:
        for suffix in ("manual/", ""):
            url = f"https://www.keyence.co.jp{path}{suffix}"
            try:
                rr = s.get(url, timeout=40)
            except Exception:
                continue
            hits = _keyence_extract(rr.text, args.lang)
            hits = [h for h in hits if q in h[1].lower()] if q else hits
            if hits:
                print(f"--- {path} ---")
                for aid, name in hits:
                    print(f"{aid}\t{name}")
                    print(f"\thttps://www.keyence.co.jp/download/download/confirmation/?dlAssetId={aid}")
                    total += 1
                break
    print(f"\n{total} 件")
    if total:
        print("※ 実ダウンロードはログイン必須。")


def _plain_session(rec):
    """Session for sites whose listing needs no cookies (e.g. shared-password)."""
    import requests

    from session import UA_FALLBACK
    s = requests.Session()
    s.headers.update({
        "User-Agent": rec.get("userAgent") or UA_FALLBACK,
        "Accept-Language": "ja,en;q=0.8",
    })
    for c in rec.get("cookies") or []:
        s.cookies.set(c["name"], c["value"], domain=c.get("domain"), path=c.get("path", "/"))
    return s


def _uniq(seq):
    seen, out = set(), []
    for x in seq:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def do_search(args, rec, kind):
    fn = {"mitsubishi": search_mitsubishi, "jtekt": search_jtekt,
          "omron": search_omron, "keyence": search_keyence}.get(args.site)
    if not fn:
        print(f"(--search は {args.site} に未対応)")
        return
    fn(args, rec)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--url")
    ap.add_argument("--out")
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--stealth", action="store_true")
    ap.add_argument("--wait", type=int, default=2500)
    ap.add_argument("--limit", type=int, default=120000)
    ap.add_argument("--links", nargs="?", const="all", default=None,
                    help="本文ではなくページ内のリンクURLを列挙する。"
                         "正規表現を渡すと絞り込む (例: --links '\\.pdf$')")
    ap.add_argument("--max-links", type=int, default=200)
    ap.add_argument("--family",
                    help="オムロン専用: 製品ファミリID (製品ページURLの /products/family/<ID>/)。"
                         "指定するとその製品の資料一覧をJSON APIから取得する")
    ap.add_argument("--site-id", default="14", help="オムロンAPIのsite_id (既定 14)")
    ap.add_argument("--search", dest="query",
                    help="そのメーカーの全製品を対象にマニュアルをキーワード検索する")
    ap.add_argument("--category",
                    help="JTEKT: plc/safety-plc/motion/hmi/software、"
                         "キーエンス: URLの一部で絞り込む")
    ap.add_argument("--max-families", type=int, default=10,
                    help="オムロン検索でたどる製品ファミリ数の上限")
    ap.add_argument("--asset",
                    help="キーエンス専用: assetID (AS_xxxxx) を指定してPDFを取得する")
    ap.add_argument("--cards", action="store_true",
                    help="キーエンス専用: サポートページ内の資料カード一覧を抽出する")
    ap.add_argument("--lang", default="ja_JP",
                    help="オムロン資料一覧の言語絞り込み (既定 ja_JP、全件は空文字)")
    args = ap.parse_args()
    if not args.url and not args.family and not args.query and not args.asset:
        ap.error("--url は必須です（--family / --search / --asset 指定時のみ省略可）")

    try:
        kind, rec = load_auth(args.site)
        if args.asset:
            keyence_download(args, rec)
        elif args.query:
            do_search(args, rec, kind)
        elif args.cards:
            keyence_cards(args, rec)
        elif args.family:
            omron_docs(args, rec)
        elif kind == "password":
            password_fetch(args, rec)
        elif args.render or args.stealth:
            rendered_fetch(args, rec)
        else:
            cookie_fetch(args, rec)
    except AuthExpired as e:
        fail_expired(str(e))


if __name__ == "__main__":
    main()
