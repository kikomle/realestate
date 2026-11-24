// local_comfyui: calls the local ComfyUI only when enabled (VIDEO_LOCAL_COMFYUI=1)
// and reachable at COMFYUI_URL (default http://127.0.0.1:8188). NOT tested against a live
// video workflow in this repo: the check is a reachability probe plus a dry manifest.
import { dryRun } from "./dry-run.mjs";

const base = process.env.COMFYUI_URL ?? "http://127.0.0.1:8188";

export const localComfyui = {
  name: "local_comfyui",
  liveTested: false,
  async reachable() {
    try {
      const r = await fetch(`${base}/system_stats`, { signal: AbortSignal.timeout(2000) });
      return r.ok;
    } catch {
      return false;
    }
  },
  async generate(args) {
    if (process.env.VIDEO_LOCAL_COMFYUI !== "1") {
      throw new Error("local_comfyui disabled: set VIDEO_LOCAL_COMFYUI=1 to enable");
    }
    if (!(await this.reachable())) {
      throw new Error(`ComfyUI not reachable at ${base}`);
    }
    // Video workflow submission is intentionally not implemented: no tested i2v workflow exists yet.
    throw new Error("local_comfyui video workflow not implemented; use dry_run to produce the manifest");
  },
};
