# Močire H apartment selector

This repository contains the Next.js implementation and its tests. The Močire H selector is a private, loopback-only prototype, not a deployed property listing.

## Run the code

Use Node.js 22 and run:

```sh
npm ci
npm run dev
```

The public checkout builds without private inputs. Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` to verify it. The synthetic sandbox at `/viewer` does not depict Močire H.

## Private demo

The public repository intentionally excludes the source snapshots (`src/data/floors.json`, `src/data/apartments.json` and the source inventories), drawings and derivatives (`assets/source/mocire-zadar-h/raw/`), and private registrations (`assets/geometry/stage2/private/`). Restore the exact authorized local inputs from the private project before running the demo. The source-dependent browser checks also require `scripts/validate/stage2-plan-witnesses.mjs`.

- Main loopback preview: `npm run dev:exterior`, then open `http://127.0.0.1:3103/exterior-preview`.
- Separate façade review: `node scripts/web/serve-stage3-preview.mjs 4174`, then open `http://127.0.0.1:4174/plan-review`. The image-based floor bands are provisional.

Do not deploy the private preview. No public-use clearance for its architectural images or registrations is recorded.
