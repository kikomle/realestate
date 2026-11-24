import { isLocalPreviewRequest } from "../../../local-access";
import { lookupApartmentMedia } from "../../apartment-source";
import { readPinnedAsset } from "../../plan-source";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(request: Request, { params }: { params: Promise<{ asset: string }> }) {
  const reject = (status: number) => new Response(null, { status, headers: privateHeaders });
  if (!isLocalPreviewRequest(request.headers)) return reject(404);
  try {
    const file = await lookupApartmentMedia((await params).asset);
    if (!file) return reject(404);
    const bytes = await readPinnedAsset(file.path, file.sha256);
    if (!bytes) return reject(409);
    return new Response(new Uint8Array(bytes), {
      headers: { ...privateHeaders, "Content-Type": "image/webp", "Content-Length": String(bytes.length) },
    });
  } catch (error) {
    return reject((error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500);
  }
}
