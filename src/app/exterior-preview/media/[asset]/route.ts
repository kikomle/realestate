import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { exteriorDimensions, exteriorViews } from "../../exterior-media";
import { isLocalPreviewRequest } from "../../local-access";

const imageHeaders = {
  "Cache-Control": "private, no-store",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

type Manifest = {
  use?: string;
  views?: Partial<Record<keyof typeof exteriorViews, {
    image_id?: string;
    size?: readonly [number, number];
    crop?: string;
    source?: { sha256?: string };
    variants?: Record<string, {
      path?: string;
      sha256?: string;
      bytes?: number;
      width?: number;
      height?: number;
      format?: string;
    }>;
  }>>;
};

export async function GET(request: Request, { params }: { params: Promise<{ asset: string }> }) {
  const respond = (status: number) => new Response(null, { status, headers: imageHeaders });
  if (!isLocalPreviewRequest(request.headers)) return respond(404);
  const { asset } = await params;
  const match = /^(arrival|facade)-(960|1280|1920)\.(avif|webp)$/.exec(asset);
  if (!match) return respond(404);
  const [, key, width, format] = match;
  const view = key === "arrival" ? "arrival" : "facade";
  const imageId = exteriorViews[view].id;
  const sourceRoot = "assets/source/mocire-zadar-h";

  try {
    // Keep raw local originals and derivatives out of the production file trace.
    const manifest = JSON.parse(
      await readFile(join(/* turbopackIgnore: true */ process.cwd(), sourceRoot, "raw/stage3/exterior/manifest.json"), "utf8"),
    ) as Manifest;
    const entry = manifest.views?.[view];
    const variant = entry?.variants?.[asset];
    const sourceHash = entry?.source?.sha256;
    const fullWebp = width === "1920" && format === "webp";
    if (manifest.use !== "PRIVATE_PREVIEW_ONLY" || entry?.image_id !== imageId ||
        entry.crop !== "none" || entry.size?.[0] !== exteriorDimensions.width ||
        entry.size?.[1] !== exteriorDimensions.height ||
        sourceHash !== exteriorViews[view].sourceSha256 || !variant) return respond(409);

    const expectedPath = fullWebp
      ? `raw/stage2/webp/${imageId}-${sourceHash.slice(0, 12)}.webp`
      : `raw/stage3/exterior/${asset}`;
    if (variant.path !== expectedPath || variant.format !== format || variant.width !== Number(width) ||
        variant.height !== Number(width) * exteriorDimensions.height / exteriorDimensions.width) return respond(409);

    const bytes = await readFile(join(/* turbopackIgnore: true */ process.cwd(), sourceRoot, expectedPath));
    if (bytes.length !== variant.bytes ||
        createHash("sha256").update(bytes).digest("hex") !== variant.sha256) return respond(409);
    return new Response(new Uint8Array(bytes), {
      headers: { ...imageHeaders, "Content-Type": `image/${format}`, "Content-Length": String(bytes.length) },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return respond(404);
    return respond(500);
  }
}
