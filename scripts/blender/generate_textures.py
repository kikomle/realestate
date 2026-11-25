"""Generate seamless tileable architectural PBR textures + normal maps for Močire Zadar H.

Outputs albedo, roughness, and tangent-space normal maps under assets/blender/materials/mocire/
including Dalmatian dry-stone ashlar, architectural ETICS plaster, permeable grass-grid parking
pavers (travne rešetke, matching Mocire_H-Zadar_006/_007), asphalt, terrace tile, and lawn.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, "assets/blender/materials/mocire")
os.makedirs(OUT_DIR, exist_ok=True)

RNG = np.random.default_rng(42)


def tileable_noise(size, octaves=(4, 8, 16, 32, 64), weights=(0.35, 0.25, 0.2, 0.12, 0.08)):
    acc = np.zeros((size, size), dtype=np.float32)
    for freq, w in zip(octaves, weights):
        grid = RNG.random((freq, freq), dtype=np.float32)
        im = Image.fromarray((grid * 255).astype(np.uint8)).resize((size, size), Image.Resampling.BICUBIC)
        acc += (np.asarray(im, dtype=np.float32) / 255.0) * w
    acc = (acc - acc.min()) / max(acc.max() - acc.min(), 1e-5)
    return acc


def save_rgb(arr, name):
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    Image.fromarray(arr, mode="RGB").save(os.path.join(OUT_DIR, name), quality=90)


def save_gray(arr, name):
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    Image.fromarray(arr, mode="L").save(os.path.join(OUT_DIR, name), quality=90)


def height_to_normal(height_01, strength=2.5):
    """Convert a tileable [0,1] heightmap to an OpenGL tangent-space normal map (RGB)."""
    h = height_01.astype(np.float32)
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * strength
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * strength
    nx = -dx
    ny = dy
    nz = np.ones_like(h)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx /= norm
    ny /= norm
    nz /= norm
    rgb = np.stack([(nx * 0.5 + 0.5) * 255.0, (ny * 0.5 + 0.5) * 255.0, (nz * 0.5 + 0.5) * 255.0], axis=-1)
    return rgb


def make_stucco(base_rgb, prefix, contrast=13):
    size = 512
    n_macro = tileable_noise(size, (4, 8, 16), (0.5, 0.3, 0.2))
    n_fine = RNG.normal(0.0, 1.0, (size, size)).astype(np.float32)
    n_fine = np.asarray(
        Image.fromarray(np.clip((n_fine * 0.25 + 0.5) * 255, 0, 255).astype(np.uint8)).filter(
            ImageFilter.GaussianBlur(radius=0.55)
        ),
        dtype=np.float32,
    ) / 255.0
    combined = 0.60 * n_macro + 0.40 * n_fine
    rgb = np.zeros((size, size, 3), dtype=np.float32)
    for c in range(3):
        rgb[:, :, c] = base_rgb[c] + (combined - 0.5) * contrast * 2.0
    save_rgb(rgb, f"{prefix}_albedo.jpg")
    save_gray(198 + (combined - 0.5) * 44, f"{prefix}_rough.jpg")
    save_rgb(height_to_normal(combined, strength=1.4), f"{prefix}_normal.jpg")


def make_dalmatian_stone():
    """Textured Dalmatian dry-stone ashlar retaining wall with crisp normal relief."""
    size = 512
    img = Image.new("RGB", (size, size), (124, 122, 118))
    height = Image.new("L", (size, size), 55)
    rough = Image.new("L", (size, size), 240)
    draw = ImageDraw.Draw(img)
    hdraw = ImageDraw.Draw(height)
    rdraw = ImageDraw.Draw(rough)

    rows = 12
    row_h = size // rows
    for r in range(rows):
        y0 = r * row_h
        y1 = size if r == rows - 1 else (r + 1) * row_h
        x = -(r % 2) * 28
        while x < size:
            bw = int(RNG.integers(40, 88))
            tone = int(RNG.integers(172, 220))
            warm = int(RNG.integers(-5, 9))
            col = (tone + warm, tone + warm // 2, tone - 3)
            draw.rectangle([x + 2, y0 + 2, x + bw - 2, y1 - 2], fill=col, outline=(102, 100, 96), width=2)
            ht = int(RNG.integers(180, 245))
            hdraw.rectangle([x + 3, y0 + 3, x + bw - 3, y1 - 3], fill=ht)
            rtone = int(RNG.integers(185, 228))
            rdraw.rectangle([x + 2, y0 + 2, x + bw - 2, y1 - 2], fill=rtone)
            x += bw

    h_arr = np.asarray(height.filter(ImageFilter.GaussianBlur(radius=1.2)), dtype=np.float32) / 255.0
    grain = tileable_noise(size, (16, 32, 64), (0.4, 0.35, 0.25))
    arr = np.asarray(img, dtype=np.float32)
    for c in range(3):
        arr[:, :, c] += (grain - 0.5) * 26.0
    save_rgb(arr, "stone_wall_albedo.jpg")
    save_gray(np.asarray(rough, dtype=np.float32) + (grain - 0.5) * 20.0, "stone_wall_rough.jpg")
    save_rgb(height_to_normal(h_arr * 0.8 + grain * 0.2, strength=5.5), "stone_wall_normal.jpg")


def make_grass_paver():
    """Permeable concrete grass-grid parking pavers (travne rešetke) seen in _006 & _007."""
    size = 512
    img = Image.new("RGB", (size, size), (168, 168, 165))
    height = Image.new("L", (size, size), 220)
    draw = ImageDraw.Draw(img)
    hdraw = ImageDraw.Draw(height)
    step = 32
    for y in range(0, size, step):
        for x in range(0, size, step):
            g_var = int(RNG.integers(-14, 16))
            grass_col = (98 + g_var // 2, 134 + g_var, 62 + g_var // 2)
            draw.rectangle([x + 6, y + 6, x + step - 6, y + step - 6], fill=grass_col)
            hdraw.rectangle([x + 6, y + 6, x + step - 6, y + step - 6], fill=115)
    n = tileable_noise(size, (8, 32, 64), (0.4, 0.35, 0.25))
    arr = np.asarray(img, dtype=np.float32)
    for c in range(3):
        arr[:, :, c] += (n - 0.5) * 18.0
    save_rgb(arr, "grass_paver_albedo.jpg")
    save_rgb(height_to_normal(np.asarray(height, dtype=np.float32) / 255.0, strength=3.0), "grass_paver_normal.jpg")


def make_asphalt():
    size = 512
    n1 = tileable_noise(size, (4, 8, 16, 64), (0.35, 0.25, 0.2, 0.2))
    speck = RNG.normal(0.0, 1.0, (size, size)).astype(np.float32) * 8.0
    base = 102 + (n1 - 0.5) * 26.0 + speck
    rgb = np.stack([base * 0.99, base, base * 1.03], axis=-1)
    save_rgb(rgb, "asphalt_albedo.jpg")
    save_gray(202 + (n1 - 0.5) * 42.0, "asphalt_rough.jpg")
    save_rgb(height_to_normal(n1, strength=1.8), "asphalt_normal.jpg")


def make_lawn():
    size = 512
    n1 = tileable_noise(size, (4, 8, 16, 32), (0.4, 0.3, 0.2, 0.1))
    fine = RNG.normal(0.0, 1.0, (size, size)).astype(np.float32) * 7.0
    r = 86 + (n1 - 0.5) * 34 + fine
    g = 118 + (n1 - 0.5) * 42 + fine * 1.1
    b = 50 + (n1 - 0.5) * 20 + fine * 0.6
    save_rgb(np.stack([r, g, b], axis=-1), "lawn_albedo.jpg")
    save_gray(225 + (n1 - 0.5) * 24, "lawn_rough.jpg")
    save_rgb(height_to_normal(n1, strength=2.2), "lawn_normal.jpg")


def make_terrace_tiles():
    size = 512
    img = Image.new("RGB", (size, size), (168, 164, 156))
    height = Image.new("L", (size, size), 120)
    draw = ImageDraw.Draw(img)
    hdraw = ImageDraw.Draw(height)
    step = 64
    for y in range(0, size, step):
        for x in range(0, size, step):
            v = int(RNG.integers(-6, 7))
            draw.rectangle([x + 2, y + 2, x + step - 2, y + step - 2], fill=(204 + v, 199 + v, 191 + v))
            hdraw.rectangle([x + 2, y + 2, x + step - 2, y + step - 2], fill=225)
    arr = np.asarray(img, dtype=np.float32)
    n = tileable_noise(size, (8, 32), (0.5, 0.5))
    for c in range(3):
        arr[:, :, c] += (n - 0.5) * 10
    save_rgb(arr, "terrace_albedo.jpg")
    save_rgb(height_to_normal(np.asarray(height, dtype=np.float32) / 255.0, strength=2.2), "terrace_normal.jpg")


def main():
    make_stucco((104, 98, 92), "dark_plaster", contrast=12)
    make_stucco((180, 172, 161), "pale_plaster", contrast=11)
    make_stucco((222, 217, 208), "ground_plaster", contrast=9)
    make_stucco((132, 127, 105), "olive_hood", contrast=10)
    make_dalmatian_stone()
    make_grass_paver()
    make_asphalt()
    make_lawn()
    make_terrace_tiles()
    print("TEXTURES_AND_NORMALS_OK:", len(os.listdir(OUT_DIR)), "files")


if __name__ == "__main__":
    main()
