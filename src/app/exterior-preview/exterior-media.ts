import type { ExteriorImage } from "@/components/exterior-preview/exterior-viewport";

export const exteriorViews = {
  arrival: {
    id: "Mocire_H-Zadar_001",
    sourceSha256: "632da4f4a89bf125279f08553343a708d8bc352fcbbb97b5a5e285d2ce04d13c",
    alt: "Kosi pogled na stambenu zgradu Močire H u Zadru",
  },
  facade: {
    id: "Mocire_H-Zadar_000",
    sourceSha256: "6854a82a8bb08275305cb0351ca9534e32a7ee4dbadca30c2d3ac98b7818ec2a",
    alt: "Glavno pročelje stambene zgrade Močire H u Zadru",
  },
} as const;

export const exteriorWidths = [960, 1280, 1920] as const;
export const exteriorDimensions = { width: 1920, height: 1080 } as const;
export type ExteriorFormat = "avif" | "webp";
type View = keyof typeof exteriorViews;

function imageUrl(view: View, width: (typeof exteriorWidths)[number], format: ExteriorFormat) {
  return `/exterior-preview/media/${view}-${width}.${format}`;
}

function exteriorImage(view: View): ExteriorImage {
  const { id, alt } = exteriorViews[view];
  const srcSet = (format: ExteriorFormat) =>
    exteriorWidths.map(width => `${imageUrl(view, width, format)} ${width}w`).join(", ");
  return {
    id,
    alt,
    ...exteriorDimensions,
    src: imageUrl(view, 1920, "webp"),
    avifSrcSet: srcSet("avif"),
    webpSrcSet: srcSet("webp"),
  };
}

export const exteriorImages = { arrival: exteriorImage("arrival"), facade: exteriorImage("facade") };
