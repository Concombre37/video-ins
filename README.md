# BF Studio — vidéos courtes Black Friday (Remotion + Claude)

Tu décris la vidéo, tu ajoutes tes photos produits, et **Claude** écrit l'animation.
Tu la regardes tout de suite dans le navigateur, tu l'ajustes en discutant avec lui, puis tu
**télécharges un MP4 vertical 1080×1920** prêt pour Instagram Reels, TikTok ou YouTube Shorts.

Ce projet part du template officiel [Remotion « Prompt to Motion Graphics »](https://www.remotion.dev/docs/ai/ai-saas-template)
(sa documentation d'origine est dans `README.remotion-original.md`). Voici ce qui a été adapté :

| Template d'origine | BF Studio |
|---|---|
| OpenAI (GPT) | **Claude** (Sonnet / Opus / Haiku, avec une option « thinking ») |
| Format 16:9 | **Format 9:16** (Reels / Shorts), avec les zones sûres d'Instagram |
| Les images servent seulement de référence à l'IA | **Les photos produits apparaissent dans la vidéo** (`PRODUCT_IMAGES`) |
| Rendu sur AWS Lambda (payant) | **Rendu dans le navigateur** (gratuit) **et rendu en ligne de commande** pour les agents |
| Skills génériques | En plus : les skills **`promo-ad`** et **`product-showcase`**, et un exemple Black Friday complet |
| — | Skills **Claude Code** (`.claude/skills/`) : les skills officiels Remotion + `bf-short-video` |

## Démarrer

```bash
npm install
cp .env.example .env        # puis mets ta clé : ANTHROPIC_API_KEY=sk-ant-...
npm run dev                 # ouvre http://localhost:3000
```

1. Écris par exemple : *« Pub Black Friday pour ces sneakers, -40 %, 89 € → 53 €, style noir et jaune, CTA lien en bio »*.
2. Joins tes photos produits avec le trombone, ou glisse-les dans la zone de saisie.
3. Corrige en discutant : *« plus rapide »*, *« mets le prix plus gros »*, etc. Le bouton **Use Frame** envoie à Claude une capture de l'image en cours.
4. Clique sur **Render & Download** pour obtenir un MP4. Il faut **Chrome ou Edge** (le rendu passe par WebCodecs).

Tu peux voir l'exemple prêt à l'emploi sur `/code-examples?example=black-friday-promo`.

## Pour ton agent Instagram (sans interface)

```bash
npm run short -- --images public/products/a.jpg,public/products/b.jpg --seconds 12 --out out/bf.mp4
npm run short -- --code out/ma-pub.tsx --images ... --out out/ma-pub.mp4   # avec ton propre composant
```

Le dossier `.claude/skills/bf-short-video/SKILL.md` décrit toute la marche à suivre :
photos → composant → rendu → vérification → légende → publication en Reel.
Lance `claude` dans ce dossier : les skills se chargent tout seuls.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `ANTHROPIC_API_KEY` | Obligatoire pour la génération |
| `CLAUDE_FAST_MODEL` | Modèle utilisé pour la validation et la détection des skills (par défaut `claude-haiku-5-5`) |
| `NEXT_PUBLIC_REMOTION_LICENSE_KEY` | Clé de licence Remotion pour le rendu dans le navigateur (voir ci-dessous) |
| `REMOTION_BROWSER` | Chemin vers Chromium pour le rendu en ligne de commande (facultatif) |

## Licence Remotion ⚠️

Remotion est **gratuit pour les particuliers et les entreprises de 3 personnes au maximum**. Au-delà,
une licence entreprise est obligatoire. Voir https://remotion.dev/license.
