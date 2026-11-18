# BF Studio

Générateur de vidéos courtes 9:16 (Reels/Shorts) pour les promos, basé sur le template officiel
Remotion « Prompt to Motion Graphics » adapté à Claude.

- Interface web : `npm run dev` → http://localhost:3000 (clé `ANTHROPIC_API_KEY` dans `.env`).
- Rendu headless : `npm run short -- --images ... --out out/x.mp4` (voir skill `bf-short-video`).
- Génération IA : `src/app/api/generate/route.ts` (Claude via `@ai-sdk/anthropic`).
- Skills injectés dans le prompt : `src/skills/*.md` (dont `promo-ad`, `product-showcase`).
- Photos produits : `src/remotion/product-images.ts` → variable globale `PRODUCT_IMAGES` dans le code généré.
- Rendu navigateur : `src/helpers/use-rendering.ts` (WebCodecs, Chrome/Edge).
- Skills Claude Code : `.claude/skills/` (officiels Remotion + `bf-short-video`).
