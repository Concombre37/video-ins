---
name: bf-short-video
description: Créer une pub vidéo HytLabs (Reel / Short / TikTok 9:16, post 1:1 ou YouTube 16:9) avec logo et musique, et la rendre en MP4 prête à publier. À utiliser quand on demande une pub, un reel, un short ou une vidéo promo.
---

# Créer une pub vidéo HytLabs

Projet : HytLabs Studio (Next.js + Remotion). Formats 9:16 (1080x1920, défaut), 1:1 (1080x1080), 16:9 (1920x1080), 30 fps.
Le logo et les couleurs HytLabs sont disponibles dans le code via la globale `BRAND` (sans import) :
`BRAND.logo.onDark` / `onLight` (ratio `BRAND.logo.aspectRatio`), `BRAND.symbol.violet`, `BRAND.colors`, `BRAND.url`.

## Étapes

1. **Récupérer les photos** du produit → les copier dans `public/products/` (jpg/png/webp).
2. **Écrire le composant** dans `out/<nom>.tsx`, au format du générateur :
   - `import { ... } from "remotion";` puis `export const MyAnimation = () => { ... };`
   - Composants auxiliaires déclarés AVANT `export const MyAnimation`.
   - Photos via le tableau global `PRODUCT_IMAGES` (sans import) : `<Img src={PRODUCT_IMAGES[i % PRODUCT_IMAGES.length]} />`.
   - Partir de l'exemple `src/examples/code/black-friday-promo.ts` et suivre `src/skills/promo-ad.md`
     et `src/skills/product-showcase.md` (hook 1,5 s, 1 photo / 2 s, prix barré, CTA "LIEN EN BIO").
   - Zones sûres Instagram (9:16) : rien d'important dans les 200 px du haut ni les 350 px du bas.
   - Lire la taille avec `useVideoConfig()` plutôt que la coder en dur ; logo HytLabs dans chaque vidéo.
3. **Rendre** :
   ```bash
   node scripts/render-short.mjs --code out/<nom>.tsx --images public/products/a.jpg,public/products/b.jpg --seconds 12 --format 9:16 --music energique --out out/<nom>.mp4
   ```
   Musiques : `energique`, `gaming`, `epique`, `chill`, `none` ou chemin d'un fichier audio ; `--volume 0.6`.
   Sans `--code`, l'exemple Black Friday intégré est utilisé. Dans un conteneur sans Chrome Remotion,
   définir `REMOTION_BROWSER=/chemin/vers/chromium`.
4. **Vérifier** : extraire 3-4 images (`ffmpeg -ss 2 -i out/x.mp4 -frames:v 1 f.png`) et les regarder
   (texte lisible, photo visible, rien de coupé).
5. **Légende Instagram** : 2-3 phrases + emojis + 5-10 hashtags (#blackfriday #promo …), écrite dans `out/<nom>.txt`.
6. Donner le chemin du MP4 + la légende à l'agent de publication Instagram (publier en **Reel**).

Pour les règles Remotion générales, voir le skill `remotion-best-practices`.
