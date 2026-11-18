# Saves The Lab's public site (Kylar's platform, on its Cloudflare Worker) as static files in the-lab/, which
# GitHub Pages serves at appliedlab.ai (.github/workflows/pages.yml). Run it again after the public pages change:
#
#   SSL_CERT_FILE=/etc/ssl/cert.pem python3 -I scripts/snapshot-the-lab.py the-lab
#   scripts/publish-live.sh "Refresh The Lab's site"
#
# Clear the-lab/ first so files the site no longer uses don't linger.
import re, sys, os, urllib.request

ORIGIN = "https://arch.ds2dev.workers.dev"
OUT = sys.argv[1]
APP = ("/signin", "/join", "/w", "/p", "/demo", "/dev", "/f", "/u")


def is_app(p):
    return any(p == a or p.startswith(a + "/") or p.startswith(a + "?") for a in APP)


def get(p):
    req = urllib.request.Request(ORIGIN + p, headers={"User-Agent": "Mozilla/5.0 snapshot"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read(), r.headers.get("content-type", "")


def save(path, data):
    f = os.path.join(OUT, path.lstrip("/"))
    os.makedirs(os.path.dirname(f), exist_ok=True)
    with open(f, "wb") as fh:
        fh.write(data)


ASSET_PREFIX = ("/_next/", "/api/public-image", "/api/brand", "/fonts/")
pages = ["/", "/how-it-works", "/students", "/partners", "/faculty", "/principles", "/showcase", "/meet"]
seen, assets, skipped = set(), set(), set()
while pages:
    p = pages.pop(0)
    if p in seen:
        continue
    seen.add(p)
    try:
        body, ct = get(p)
    except Exception as e:
        print("FAIL page", p, e)
        continue
    html = body.decode()
    save(p.rstrip("/") + "/index.html", body)
    print("page", p, len(body))
    found = re.findall(r'(?:href|src)="(/[^"#]*)', html)
    found += re.findall(r'\\"(/(?:_next|api/public-image|api/brand|fonts)/[^"\\]+)', html)
    found += re.findall(r'srcSet="([^"]+)"', html)
    for m in found:
        if " " in m:
            continue
        u = m.split("?")[0] if m.startswith("/_next") else m
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
        continue
    save(a, body)
    if a.endswith((".css", ".js")):
        t = body.decode("utf-8", "ignore")
        refs = re.findall(r"url\((/[^)'\"]+)\)", t)
        refs += re.findall(r'"(/_next/static/[^"]+)"', t)
        refs += re.findall(r'"(static/(?:chunks|media)/[^"]+)"', t)
        for m in refs:
            assets.add(m if m.startswith("/") else "/_next/" + m)

for extra in ["/favicon.ico", "/robots.txt", "/icon.svg", "/icon.png", "/apple-icon.png", "/sitemap.xml"]:
    try:
        b, _ = get(extra)
        save(extra, b)
        print("extra", extra)
    except Exception:
        pass

# The platform's own pages (sign in, join, the Workspace) stay on the Worker. These stand-ins send people there,
# keeping ?as=partner and the like. The old site's /login and /signup land in the same places.
STUBS = {"signin": "/signin", "join": "/join", "login": "/signin", "signup": "/join", "w": "/w", "demo": "/demo",
         "arch": "/w", "projectum": "/w", **{f"join/{k}": f"/join/{k}" for k in ("student", "faculty", "partner", "donor", "rep")}}
for path, to in STUBS.items():
    dest = ORIGIN + to
    save(f"/{path}/index.html", f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>The Lab</title>
<script>location.replace("{dest}" + location.search + location.hash);</script>
<meta http-equiv="refresh" content="0;url={dest}"></head>
<body><a href="{dest}">Continue to The Lab</a></body></html>
""".encode())

print("pages", len(seen), sorted(seen))
print("assets", len(done))
print("app links", sorted(skipped))
