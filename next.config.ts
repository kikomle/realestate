import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER && process.env.MOCIRE_EXTERIOR_PREVIEW === "1") {
    // Private plan review must send real 404s and usable text links without streaming scripts.
    return {
      ...nextConfig,
      cacheComponents: false,
      partialPrefetching: false,
      distDir: ".next-exterior-preview",
      devIndicators: false,
    };
  }
  return nextConfig;
}
