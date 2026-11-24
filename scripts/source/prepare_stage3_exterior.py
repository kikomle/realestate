"""Prepare private, uncropped Močire H preview images from the Stage 2 snapshot."""

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / 'assets/source/mocire-zadar-h'
OUT = ROOT / 'raw/stage3/exterior'
VIEWS = {'arrival': 'Mocire_H-Zadar_001', 'facade': 'Mocire_H-Zadar_000'}
WIDTHS = (960, 1280, 1920)
VIEW_SIZE = (1920, 1080)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def file_ref(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha256(path),
            'bytes': path.stat().st_size}


def main():
    ledger = json.loads((ROOT / 'stage2-manifest.json').read_text())
    assets = {a['original_name']: a for a in ledger['assets'] if a['kind'] == 'exterior'}
    OUT.mkdir(parents=True, exist_ok=True)
    views = {}
    for view, image_id in VIEWS.items():
        asset = assets[f'{image_id}.jpg']
        source = ROOT / asset['path']
        full_webp = ROOT / asset['optimized']['path']
        if (sha256(source) != asset['sha256'] or sha256(full_webp) != asset['optimized']['sha256']):
            raise ValueError(f'{image_id}: Stage 2 hash mismatch')
        variants = {}
        with Image.open(source) as img:
            if img.size != VIEW_SIZE or img.getexif().get(274, 1) != 1:
                raise ValueError(f'{image_id}: expected a native 1920×1080 frame')
            rgb = img.convert('RGB')
            for width in WIDTHS:
                height = width * VIEW_SIZE[1] // VIEW_SIZE[0]
                resized = rgb.resize((width, height), Image.Resampling.LANCZOS)
                for format, opts in [('avif', {'quality': 58, 'speed': 5}),
                                     ('webp', {'quality': 82, 'method': 6})]:
                    path = OUT / f'{view}-{width}.{format}'
                    if width == VIEW_SIZE[0] and format == 'webp':
                        path = full_webp
                    else:
                        resized.save(path, format.upper(), **opts)
                    with Image.open(path) as encoded:
                        encoded.load()
                        if encoded.size != (width, height) or encoded.format != format.upper():
                            raise ValueError(f'{image_id}: invalid derivative {path}')
                    key = f'{view}-{width}.{format}'
                    variants[key] = {**file_ref(path), 'width': width, 'height': height, 'format': format}
                    print(f'{key}: {width}×{height}, {variants[key]["bytes"]} bytes')
        views[view] = {
            'image_id': image_id, 'source': file_ref(source),
            'source_url': asset['source_url'], 'retrieved_at': asset['retrieved_at'],
            'size': list(VIEW_SIZE), 'crop': 'none', 'variants': variants,
        }
    (OUT / 'manifest.json').write_text(json.dumps({
        'use': 'PRIVATE_PREVIEW_ONLY', 'views': views,
    }, indent=2) + '\n')


if __name__ == '__main__':
    main()
