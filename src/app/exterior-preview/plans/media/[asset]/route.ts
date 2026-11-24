import { isLocalPreviewRequest } from "../../../local-access";
import { findProofPlan, readPinnedAsset } from "../../plan-source";

const mediaHeaders = {
  "Cache-Control": "private, no-store",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(request: Request, { params }: { params: Promise<{ asset: string }> }) {
  const reject = (status: number) => new Response(null, { status, headers: mediaHeaders });
  if (!isLocalPreviewRequest(request.headers)) return reject(404);
  const { asset } = await params;
  if (!asset.endsWith(".webp")) return reject(404);
  const plan = await findProofPlan(asset.slice(0, -5));
  if (!plan) return reject(404);

  try {
    const bytes = await readPinnedAsset(plan.private_plan, plan.optimized_sha256);
    if (!bytes) return reject(409);
    return new Response(new Uint8Array(bytes), {
      headers: { ...mediaHeaders, "Content-Type": "image/webp", "Content-Length": String(bytes.length) },
    });
  } catch (error) {
    return reject((error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500);
  }
}
