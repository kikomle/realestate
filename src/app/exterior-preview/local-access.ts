export const localPreviewEnabled = () =>
  process.env.NODE_ENV === "development" && process.env.MOCIRE_EXTERIOR_PREVIEW === "1";

export function isLocalPreviewRequest(headers: Pick<Headers, "get">) {
  return localPreviewEnabled() &&
    /^127\.0\.0\.1(?::\d{1,5})?$/.test(headers.get("host") ?? "") &&
    headers.get("sec-fetch-site") !== "cross-site";
}
