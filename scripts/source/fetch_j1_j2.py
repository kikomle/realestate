"""Fetch Močire Zadar J1 & J2 reference images into local-only assets/source/ for visual inspection."""
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, "assets/source/mocire-zadar-j1-j2")
os.makedirs(OUT_DIR, exist_ok=True)

URL = "https://www.sigma.hr/projekti/mocire-zadar-j1-i-j2/"

def main():
    html = subprocess.check_output(["curl", "-fsSL", "-A", "Mozilla/5.0", URL], timeout=30).decode("utf-8", errors="ignore")
    # Find full-res wp-content/uploads images (skip resized -300x200 thumbnails)
    urls = sorted(set(re.findall(r"https://www\.sigma\.hr/wp-content/uploads/[^\"'\s)>]+\.(?:jpg|jpeg|png|webp)", html, re.I)))
    full = [u for u in urls if not re.search(r"-\d{2,4}x\d{2,4}\.(?:jpg|jpeg|png|webp)$", u, re.I)]
    print(f"Found {len(full)} full-res images on J1/J2 page:")
    for u in full:
        name = os.path.basename(u)
        if any(skip in name.lower() for skip in ("logo", "icon", "favicon")):
            continue
        dst = os.path.join(OUT_DIR, name)
        try:
            subprocess.check_call(["curl", "-fsSL", "-A", "Mozilla/5.0", "-o", dst, u], timeout=30)
            print(f"  SAVED {name} ({os.path.getsize(dst)//1024} KB) <- {u}")
        except Exception as e:
            print(f"  ERR {name}: {e}")

if __name__ == "__main__":
    main()
