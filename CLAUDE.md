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

## Espaces, SSO et médiathèque (2026-11-21)

- Connexion obligatoire (`src/proxy.ts`) par le SSO de hytlabs.com : extension WordPress
  `hytlabs-studio-sso.php` (mu-plugin, source dans /root/video-studio-deploy/wp) → jeton HMAC court
  → `/api/auth/sso` → cookie de session signé (`src/lib/auth.ts`, `SSO_SECRET`, `SESSION_SECRET`).
- Espaces (`src/lib/spaces.ts`) : `hytlabs` (admins) et `elsass` (client Elsass SimRacing). Accès donné dans
  WordPress (profil utilisateur → « Studio vidéo »), les admins WP voient tout. Données d'un espace :
  `src/lib/space-data.ts` (HytLabs = DATA_DIR d'origine, autres = DATA_DIR/spaces/<espace>).
- Identité par espace : `src/remotion/active-brand.ts` (globale BRAND), consignes `src/lib/brand-prompts.ts`,
  modèles `ELSASS_TEMPLATES`, thème CSS `[data-space="elsass"]`.
- Médiathèque (`src/lib/media-store.ts`, page `/media`) avec versions ; retouches (`src/lib/requests-store.ts`,
  page `/requests`) ; crédit en euros par espace (`src/lib/budget-store.ts`, page `/admin`), débité du coût réel
  de chaque génération ou retouche IA (USD_EUR).
- Retouche automatique (`src/lib/auto-retouch.ts`) : chaque demande (ou réponse du client) part à l'IA (OpenRouter,
  `AUTO_RETOUCH_MODEL`, Haiku par défaut) avec des images de la version actuelle, puis rendu serveur
  (`scripts/render-job.mjs`, ffmpeg requis) et livraison : nouvelle version du média ou nouveau rendu du projet.
  Un MP4 livré sans code devient un projet `rt-<média>` dont le fichier d'origine est la globale `SOURCE`
  (`src/remotion/source-media.ts`) ; les retouches s'empilent par-dessus. `// IMPOSSIBLE:` ou un rendu raté
  → la demande reste ouverte pour l'équipe. Client prévenu par email (route REST signée du mu-plugin WordPress).
