"""Register the private single-unit drawings to the actual whole-plan rasters.

Fit from matching image features, never from HTML image maps. A room point
read from the original drawing disambiguates similar neighbouring apartments.
Save the measured transform and residuals; reject poorly supported fits.
"""
import argparse
import hashlib
import json
from pathlib import Path

import cv2 as cv
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets/source/mocire-zadar-h"
PRIVATE = ROOT / "assets/geometry/stage2/private"
SIFT = cv.SIFT_create(contrastThreshold=.025)


def raster(path):
    rgba = np.array(Image.open(path).convert("RGBA"))
    alpha = rgba[:, :, 3] / 255
    gray = cv.cvtColor(rgba[:, :, :3], cv.COLOR_RGB2GRAY)
    return (gray * alpha + 255 * (1-alpha)).astype("uint8"), rgba[:, :, 3]


def components(alpha):
    _, labels, stats, _ = cv.connectedComponentsWithStats((alpha > 100).astype("uint8"))
    return [(labels == i).astype("uint8") for i, s in enumerate(stats[1:], 1)
            if s[cv.CC_STAT_AREA] > .035 * alpha.size]


def register(gray, component, plan, prior):
    cont = max(cv.findContours(component, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)[0], key=cv.contourArea)
    x,y,w,h = cv.boundingRect(cont)
    q = gray[y:y+h,x:x+w]
    k = .36
    q = cv.resize(q, None, fx=k, fy=k, interpolation=cv.INTER_AREA)
    src_kp, src_desc = SIFT.detectAndCompute(q, None)
    px,py = prior
    left,top = max(0,px-420),max(0,py-425)
    ref = plan[top:py+425,left:px+420]
    dst_kp, dst_desc = SIFT.detectAndCompute(ref, None)
    if src_desc is None or dst_desc is None: return None
    matches = cv.BFMatcher().knnMatch(src_desc, dst_desc, k=2)
    passed = [a for a,b in matches if a.distance < .84*b.distance]
    src = np.float32([src_kp[m.queryIdx].pt for m in passed])/k + [x,y]
    dst = np.float32([dst_kp[m.trainIdx].pt for m in passed]) + [left,top]
    fit = None
    for _ in range(8):
        if len(src) < 8: break
        M, inlier = cv.estimateAffinePartial2D(src, dst, method=cv.RANSAC, ransacReprojThreshold=2.2,
                                                maxIters=7000, confidence=.999)
        if M is None: break
        ix = inlier.ravel().astype(bool)
        # Some individual sheets turn the plan 90 degrees. Preserve that
        # quarter turn; do not allow a shear or a reflection to improve a fit.
        X,Y = src[ix],dst[ix]
        angle = np.arctan2(M[1,0],M[0,0])
        quarter = int(round(angle/(np.pi/2)))
        if len(X)>=8 and abs(angle-quarter*np.pi/2)<.025:
            c,s = round(np.cos(quarter*np.pi/2)),round(np.sin(quarter*np.pi/2))
            R = np.array([[c,-s],[s,c]])
            X = X@R.T
            sc = ((X-X.mean(0))*(Y-Y.mean(0))).sum()/((X-X.mean(0))**2).sum()
            offset = np.median(Y-sc*X, axis=0)
            err = np.linalg.norm(sc*X+offset-Y,axis=1)
            support = np.ptp(sc*X,axis=0)
            boundary = (sc*(cont@R.T)+offset).astype("float32")
            if (cv.pointPolygonTest(boundary,(float(px),float(py)),False)>0 and
                min(support)>25 and np.median(err)<1.25):
                fit = dict(scale=float(sc), rotation=R.tolist(), offset=offset.tolist(), inliers=int(ix.sum()),
                           median_error_px=round(float(np.median(err)),3), span_px=support.round(1).tolist())
                break
        src,dst = src[~ix],dst[~ix]
    return fit


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--level", action="append")
    args.add_argument("--witnesses",required=True,type=Path)
    opts=args.parse_args()
    witnesses = json.loads(opts.witnesses.read_text())
    # Per-asset receipts are also available before the overview manifest is finalized.
    receipts = [json.loads(p.read_text()) for p in (SRC/"raw/stage2/receipts").glob("*.json")]
    units = {r["unit_id"]:r for r in receipts if r["kind"]=="unit-plan"}
    PRIVATE.mkdir(parents=True,exist_ok=True)
    cv.setRNGSeed(3731)
    for pin in witnesses:
        image_id = pin["id"]
        if opts.level and image_id not in opts.level: continue
        im = SRC/"raw"/pin["file"]
        assert hashlib.sha256(im.read_bytes()).hexdigest() == pin["sha256"]
        png,_ = raster(im)
        prior = {}
        for name,x,y in pin["points"]:
            if name: prior.setdefault(name,(x,y))
        out = {}
        for name,point in prior.items():
            if name not in units: continue
            rec=units[name]
            image=SRC/rec["path"]
            gray,alpha = raster(image)
            candidates = []
            for mask in components(alpha):
                fit=register(gray,mask,png,point)
                if fit:
                    contour=max(cv.findContours(mask,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE)[0],key=cv.contourArea)
                    verts=(cv.approxPolyDP(contour,1.5/fit['scale'],True)[:,0,:]@np.array(fit['rotation']).T)*fit["scale"]+fit["offset"]
                    candidates.append({**fit,"source_outline_px":verts.round(2).tolist()})
            if candidates:
                best=max(candidates,key=lambda f:f['inliers'])
                out[name] = {**best,"unit_image_sha256":rec["sha256"],"unit_image_path":rec["path"]}
            else:
                print("No fit:",image_id,name,flush=True)
        (PRIVATE/f"{image_id}-fits.json").write_text(json.dumps(out,indent=2)+"\n")
        print(image_id,len(out),"/",len(prior),"matches",flush=True)


if __name__=="__main__": main()
