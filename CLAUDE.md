# HytLabs Studio

Générateur de pubs vidéo HytLabs (9:16, 1:1, 16:9, avec musique), basé sur le template officiel
Remotion « Prompt to Motion Graphics » adapté à Claude. Interface en français.

- Interface web : `npm run dev` → http://localhost:3000 (`OPENROUTER_API_KEY` ou `ANTHROPIC_API_KEY` dans `.env`).
- Rendu headless : `npm run short -- --format 9:16 --music energique --out out/x.mp4` (voir skill `bf-short-video`).
- Génération IA : `src/app/api/generate/route.ts` (Claude via `@ai-sdk/anthropic`, OpenRouter si configuré ;
  consignes de format/durée dans `formatSection`, coût calculé avec `src/lib/pricing.ts`).
- Réglages partagés (formats, durées, musiques, `usd`) : `src/lib/video-settings.ts`.
- Modèles de pubs de l'accueil : `src/examples/templates.ts`.
- Identité HytLabs dans le code généré : globale `BRAND` (`src/remotion/brand.ts`) ; photos : `PRODUCT_IMAGES`.
- Musique : `src/remotion/with-music.tsx` (aperçu, rendu navigateur et CLI) ; pistes générées par `scripts/make-music.py`.
- Historique (projets + MP4) : `src/lib/history-store.ts`, API `src/app/api/history/`, page `/history`.
- Rendu navigateur : `src/helpers/use-rendering.ts` (WebCodecs, Chrome/Edge), archivé dans l'historique.
- Skills Claude Code : `.claude/skills/` (officiels Remotion + `bf-short-video`).
- Ne pas laisser de `.tsx` hors de `src/` dans le build : `out/` et `data/` sont exclus du tsconfig.
