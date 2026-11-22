# Fetch the platform's public pages and assets for GitHub Pages. Pass a fresh
# output directory so obsolete files cannot carry over between snapshots.
# The Pages workflow runs this on a schedule and keeps the last successful
# deployment if a required page or asset cannot be fetched.
import re, sys, os, urllib.request
from urllib.error import URLError
from urllib.parse import urlsplit

ORIGIN = "https://arch.ds2dev.workers.dev"
APP = ("/signin", "/join", "/w", "/p", "/demo", "/dev", "/f", "/u")


def is_app(p):
    return any(p == a or p.startswith(a + "/") or p.startswith(a + "?") for a in APP)


class PlatformRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target = urlsplit(newurl)
        if (target.scheme, target.netloc) != ("https", urlsplit(ORIGIN).netloc):
            raise URLError("Redirect outside the platform origin")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


opener = urllib.request.build_opener(PlatformRedirects())


def get(p):
    if not p.startswith("/"):
        raise URLError("Expected a platform path")
    req = urllib.request.Request(ORIGIN + p, headers={"User-Agent": "Mozilla/5.0 snapshot"})
    with opener.open(req, timeout=60) as r:
        return r.read(), r.headers.get("content-type", "")


def save(out, path, data):
    f = os.path.join(out, path.lstrip("/"))
    # Paths come from links in pages, which people write.
    if not os.path.realpath(f).startswith(os.path.realpath(out) + os.sep):
        print("SKIP outside the site", path)
        return
    os.makedirs(os.path.dirname(f), exist_ok=True)
    with open(f, "wb") as fh:
        fh.write(data)


# A static host can't serve the calendar or take the reminder form's post, so both go to the platform. The form
# becomes a link. The link waits until React has taken over the form (adding it sooner is a hydration error), or three
# seconds if React never does, and is put back if React redraws the page.
REMINDER_FIX = f"""<style>form[data-testid="reminder-form"]{{display:none}}</style>
<script>(function(){{var late=false;function fix(){{var f=document.querySelector('form[data-testid="reminder-form"]');
if(!f||document.getElementById("reminder-link"))return;
if(!late&&!Object.keys(f).some(function(k){{return k.indexOf("__reactFiber")===0}}))return;
var a=document.createElement("a");a.id="reminder-link";a.href="{ORIGIN}/meet#reminders";a.textContent="Sign up for reminders";
a.className="press ease-colors inline-flex h-12 items-center justify-center rounded-[var(--radius)] bg-brand px-6 text-[16px] font-medium text-on-brand hover:opacity-90";
f.after(a)}}
addEventListener("load",function(){{var t=setInterval(fix,200);setTimeout(function(){{clearInterval(t);late=true;fix()}},3000);new MutationObserver(fix).observe(document.body,{{childList:true,subtree:true}})}})}})()</script>"""


def for_static_host(html):
    html = re.sub(r'((?:href=|\\":)\\?")/api/meetings', lambda m: m.group(1) + ORIGIN + "/api/meetings", html)
    if 'data-testid="reminder-form"' in html:
        html = html.replace("</body>", REMINDER_FIX + "</body>")
    return html


ASSET_PREFIX = ("/_next/", "/api/public-image", "/api/brand", "/fonts/")
def snapshot(out):
    # The old addresses stay in the list: the platform sends each on to its new page, so old links keep working.
    pages = ["/", "/features", "/get-involved", "/about", "/stories", "/meet",
             "/how-it-works", "/students", "/partners", "/faculty", "/principles", "/showcase"]
    main_pages = set(pages)
    seen, assets, skipped, broken = set(), set(), set(), []
    while pages:
        p = pages.pop(0)
        if p in seen:
            continue
        seen.add(p)
        try:
            body, ct = get(p)
        except Exception as e:
            print("FAIL page", p, e)
            if p in main_pages:
                broken.append(p)
            continue
        html = body.decode()
        save(out, p.rstrip("/") + "/index.html", for_static_host(html).encode())
        print("page", p, len(body))
        found = re.findall(r'(?:href|src)="(/[^"#]*)', html)
        found += re.findall(r'\\"(/(?:_next|api/public-image|api/brand|fonts)/[^"\\]+)', html)
        found += re.findall(r'srcSet="([^"]+)"', html)
        for m in found:
            if " " in m:
                continue
            u = m.split("?")[0] if m.startswith("/_next") else m
            if u.split("?")[0].rstrip("/") == "/projectum":
                continue
            if re.match(r"/icon\.\w+\?", u):
                continue  # the tab icon with a cache tag; saved without it below
            if u.startswith(ASSET_PREFIX) or re.search(r"\.(png|jpg|jpeg|svg|webp|ico|woff2?|txt|xml|webmanifest)$", u):
                assets.add(u)
            elif is_app(u.split("?")[0]) or u.startswith("/api/"):
                skipped.add(u.split("?")[0])
            else:
                pages.append(u.split("?")[0])

    done = set()
    while assets - done:
        a = sorted(assets - done)[0]
        done.add(a)
        try:
            body, ct = get(a)
        except Exception as e:
            print("FAIL asset", a, e)
            if a.startswith("/_next/static/") and a.endswith((".css", ".js")):
                broken.append(a)
            continue
        save(out, a, body)
        if a.endswith((".css", ".js")):
            t = body.decode("utf-8", "ignore")
            refs = re.findall(r"url\((/[^)'\"]+)\)", t)
            refs += re.findall(r'"(/_next/static/[^"]+)"', t)
            refs += re.findall(r'"(static/(?:chunks|media)/[^"]+)"', t)
            for m in refs:
                assets.add(m if m.startswith("/") else "/_next/" + m)

    for extra in ["/favicon.ico", "/robots.txt", "/icon.svg", "/icon.png", "/apple-icon.png", "/sitemap.xml",
                  "/stories/rss.xml"]:
        try:
            b, _ = get(extra)
            save(out, extra, b.replace(ORIGIN.encode(), b"https://appliedlab.ai"))
            print("extra", extra)
        except Exception:
            pass

    # The platform's own pages (sign in, join, the Workspace) stay on the Worker. These stand-ins send people there,
    # keeping ?as=partner and the like. The old site's /login and /signup land in the same places.
    STUBS = {"signin": "/signin", "join": "/join", "login": "/signin", "signup": "/join", "w": "/w", "thelab": "/w", "demo": "/demo",
             "arch": "/w", **{f"join/{k}": f"/join/{k}" for k in ("student", "faculty", "partner", "donor", "rep")}}
    for path, to in STUBS.items():
        dest = ORIGIN + to
        save(out, f"/{path}/index.html", f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>The Lab</title>
    <script>location.replace("{dest}" + location.search + location.hash);</script>
    <meta http-equiv="refresh" content="0;url={dest}"></head>
    <body><a href="{dest}">Continue to The Lab</a></body></html>
    """.encode())

    # Any other address (a project, a Workspace page, a profile, a link from an email) belongs to the platform.
    save(out, "/404.html", f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>The Lab</title>
    <script>location.replace("{ORIGIN}" + location.pathname + location.search + location.hash);</script></head>
    <body><a href="{ORIGIN}">Continue to The Lab</a></body></html>
    """.encode())

    print("pages", len(seen), sorted(seen))
    print("assets", len(done))
    print("app links", sorted(skipped))
    if broken:
        sys.exit("Not safe to publish, these couldn't be saved: " + ", ".join(broken))


if __name__ == "__main__":
    snapshot(sys.argv[1])
