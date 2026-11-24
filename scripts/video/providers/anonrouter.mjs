// anonrouter: DISABLED by default. Requires ANONROUTER_API_KEY (env only, never stored)
// and VIDEO_ANONROUTER_ENABLED=1. NOT tested against a live API; no video-capable model
// ID has been verified in the anonrouter catalog (see docs/video-model-selection.md).
const base = process.env.ANONROUTER_BASE_URL ?? "https://anonrouter.invalid/v1";

export const anonrouter = {
  name: "anonrouter",
  liveTested: false,
  async generate({ imagePath, prompt, shot, options = {} }) {
    if (process.env.VIDEO_ANONROUTER_ENABLED !== "1") {
      throw new Error("anonrouter disabled: set VIDEO_ANONROUTER_ENABLED=1 to enable");
    }
    const key = process.env.ANONROUTER_API_KEY;
    if (!key) throw new Error("ANONROUTER_API_KEY is not set");
    const model = options.model;
    if (!model) throw new Error("options.model is required (no default model is assumed)");
    // Request construction only; submission is not implemented or verified.
    throw new Error(`anonrouter video submission not implemented (model=${model}, base=${base})`);
  },
};
