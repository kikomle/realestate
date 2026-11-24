"""Validate private Stage 3 image/coordinate consistency, not floor identity."""

import argparse
import hashlib
import json
from itertools import combinations
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, indent, tostring

from PIL import Image
from shapely.geometry import Point, Polygon, box

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/source/mocire-zadar-h'
PRIVATE = ROOT / 'assets/geometry/stage2/private/stage3-exterior'
DIMENSIONS = (1920, 1080)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path):
    return json.loads(path.read_text())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def check_image(record, format, size):
    file = SOURCE / record['path']
    require(digest(file) == record['sha256'] and file.stat().st_size == record['bytes'],
            f'{file}: checksum or byte count mismatch')
    with Image.open(file) as image:
        image.load()
        require(image.size == size and image.format == format, f'{file}: dimensions or format mismatch')


def write_svg(proof):
    svg = Element('svg', {'xmlns': 'http://www.w3.org/2000/svg', 'viewBox': proof['viewBox'],
                          'data-image-id': proof['image_id'], 'data-source-sha256': proof['source_sha256'],
                          'data-status': proof['status']})
    SubElement(svg, 'title').text = 'Provisional Močire H façade traces; not an approved floor key'
    for row in proof['floors']:
        if not row['polygons']:
            continue
        band = SubElement(svg, 'g', {'id': row['floor_id'], 'data-status': row['status'],
                                    'fill': '#d5dba8', 'fill-opacity': '.3', 'stroke': '#f4f2eb'})
        for ring in row['polygons']:
            SubElement(band, 'polygon', {'points': ' '.join(f'{x},{y}' for x, y in ring),
                                         'vector-effect': 'non-scaling-stroke'})
    indent(svg)
    (PRIVATE / 'provisional-floor-bands.svg').write_text(tostring(svg, encoding='unicode') + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-svg', action='store_true', help='Write a private SVG for standalone review')
    args = parser.parse_args()
    manifest = read_json(SOURCE / 'raw/stage3/exterior/manifest.json')
    ledger = read_json(SOURCE / 'stage2-manifest.json')
    require(manifest['use'] == 'PRIVATE_PREVIEW_ONLY', 'wrong preview scope')
    expected = {key: next(a for a in ledger['assets'] if a['original_name'] == image + '.jpg')
                for key, image in [('arrival', 'Mocire_H-Zadar_001'), ('facade', 'Mocire_H-Zadar_000')]}
    require(manifest['views'].keys() == expected.keys(), 'unexpected views')
    for view, source in expected.items():
        record = manifest['views'][view]
        require(record['source']['sha256'] == source['sha256'] and record['image_id'] + '.jpg' == source['original_name']
                and tuple(record['size']) == DIMENSIONS and record['crop'] == 'none', f'{view}: wrong pinned source')
        check_image(record['source'], 'JPEG', DIMENSIONS)
        keys = {f'{view}-{width}.{format}' for width in (960, 1280, 1920) for format in ('avif', 'webp')}
        require(record['variants'].keys() == keys, f'{view}: mismatched derivatives')
        for key, variant in record['variants'].items():
            _, width_ext = key.split('-')
            width, format = width_ext.split('.')
            size = (int(width), int(width) * DIMENSIONS[1] // DIMENSIONS[0])
            require(variant['format'] == format and (variant['width'], variant['height']) == size,
                    f'{key}: variant metadata mismatch')
            check_image(variant, format.upper(), size)
        print(f'{view}: {record["image_id"]} native JPEG and {len(keys)} uncropped AVIF/WebP variants verified')

    path = PRIVATE / 'registration.json'
    proof = read_json(path)
    require(proof['source_sha256'] == expected['facade']['sha256'] and proof['image_id'] == manifest['views']['facade']['image_id']
            and (proof['width_px'], proof['height_px']) == DIMENSIONS and proof['viewBox'] == '0 0 1920 1080'
            and proof['crop'] == 'none' and proof['status'] == 'PROVISIONAL_NOT_APPROVED', 'registration image pin mismatch')
    floors = {f['floor_id']: f['label'] for f in read_json(ROOT / 'src/data/floors.json')['floors']}
    ids = [row['floor_id'] for row in proof['floors']]
    require(len(ids) == len(floors) and set(ids) == floors.keys(), 'missing, duplicate or orphan floor IDs')
    extent = box(0, 0, *DIMENSIONS)
    traced = []
    for row in proof['floors']:
        floor = row['floor_id']
        if floor == 'L00':
            require(row['status'] == 'unmapped' and not row['polygons'] and row['focus'] is None, 'L00 must be list-only')
            print(f'{floor} {floors[floor]}: list-only, no polygon or focus')
            continue
        require(row['status'] == 'provisional' and row['polygons'], f'{floor}: unaccounted trace')
        shapes = []
        for ring in row['polygons']:
            require(len(ring) >= 3 and len(set(map(tuple, ring))) == len(ring), f'{floor}: invalid ring')
            shape = Polygon(ring)
            require(shape.is_valid and shape.area > 0 and extent.covers(shape), f'{floor}: invalid or out-of-bounds shape')
            shapes.append(shape)
        require(sum(shape.contains(Point(row['focus'])) for shape in shapes) == 1, f'{floor}: focus is not inside a ring')
        traced.extend((floor, shape) for shape in shapes)
        print(f'{floor} {floors[floor]}: {len(shapes)} provisional ring(s); contained focus')
    for (a, first), (b, second) in combinations(traced, 2):
        require(not first.intersection(second).area, f'{a}/{b}: polygons overlap')
    print(f'{len(ids)} canonical floors, {len(traced)} rings, zero invalid joins, overlaps or bounds violations')
    print(f'Registration SHA-256: {digest(path)} (pixel geometry only; no architectural verification)')
    if args.write_svg:
        write_svg(proof)
        print(f'Private overlay: {(PRIVATE / "provisional-floor-bands.svg").relative_to(ROOT)}')


if __name__ == '__main__':
    main()
