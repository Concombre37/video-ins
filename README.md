# HytLabs Studio — pubs vidéo (Remotion + Claude)

Tu choisis un modèle de pub ou tu décris ta vidéo, **Claude** écrit l'animation avec le logo et les couleurs HytLabs.
Tu la regardes tout de suite dans le navigateur, tu la retouches en discutant, puis tu **exportes un MP4 avec musique**
au format de ton choix : vertical 9:16 (Reels, TikTok, Shorts), carré 1:1 (post) ou paysage 16:9 (YouTube).

Ce projet part du template officiel [Remotion « Prompt to Motion Graphics »](https://www.remotion.dev/docs/ai/ai-saas-template)
(sa documentation d'origine est dans `README.remotion-original.md`). Ce qui a été ajouté :

| Template d'origine | HytLabs Studio |
|---|---|
| OpenAI (GPT) | **Claude** (Haiku par défaut, Sonnet en option), via **OpenRouter** ou directement Anthropic |
| Format 16:9 fixe | **9:16, 1:1 ou 16:9** au choix, **durée** de 6 à 30 s |
| Pas de son | **Musique** : 4 pistes fournies (libres de droits) ou ton propre fichier, avec volume et fondus |
| Interface en anglais | **Interface en français** aux couleurs HytLabs |
| Prompt libre | **Modèles de pubs** prêts (Black Friday, Minecraft, calendrier de l'Avent, Discord…) |
| Logo absent | **Logo HytLabs** injecté dans chaque vidéo (variable globale `BRAND`) |
| Les images servent de référence | **Les images apparaissent dans la vidéo** (`PRODUCT_IMAGES`) |
| Rendu sur AWS Lambda (payant) | **Rendu dans le navigateur** (gratuit) et **rendu en ligne de commande** pour les agents |
| — | **Historique** des projets et des MP4, **coût** de chaque génération, **solde** OpenRouter en bas de page |

## Démarrer

```bash
npm install
cp .env.example .env        # puis mets ta clé : ANTHROPIC_API_KEY=sk-ant-...
npm run dev                 # ouvre http://localhost:3000
```

1. Choisis un **modèle** (ou « Partir de zéro ») et adapte le texte : prix, dates, jeux.
2. Ajoute éventuellement des images (captures de jeu, visuels) : elles apparaîtront dans la vidéo.
3. Choisis le **format**, la **durée**, la **musique** et le **modèle d'IA**, puis **Générer la vidéo**.
4. Retouche en discutant : *« plus rapide »*, *« mets le prix plus gros »*… Le bouton **Capture** envoie à Claude l'image en cours.
   Si tu changes le format ou la durée, le bouton **Adapter avec Claude** réécrit la mise en page.
5. **Exporter en MP4** (Chrome ou Edge, le rendu passe par WebCodecs). Le fichier est aussi gardé dans l'**Historique**.

## Pour ton agent Instagram (sans interface)

```bash
npm run short -- --images public/products/a.jpg,public/products/b.jpg --seconds 12 --out out/bf.mp4
npm run short -- --code out/ma-pub.tsx --images ... --out out/ma-pub.mp4   # avec ton propre composant
npm run short -- --format 1:1 --music chill --volume 0.4 --seconds 8 --out out/carre.mp4
# --format 9:16 | 1:1 | 16:9      --music energique | gaming | epique | chill | none | chemin/vers/fichier.mp3
```

Le dossier `.claude/skills/bf-short-video/SKILL.md` décrit toute la marche à suivre :
photos → composant → rendu → vérification → légende → publication en Reel.
Lance `claude` dans ce dossier : les skills se chargent tout seuls.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `OPENROUTER_API_KEY` | Clé OpenRouter : si elle est définie, la génération passe par OpenRouter (et le solde s'affiche en bas) |
| `ANTHROPIC_API_KEY` | Clé Anthropic directe, utilisée si `OPENROUTER_API_KEY` est absente |
| `DATA_DIR` | Dossier de l'historique (projets + MP4), par défaut `./data` |
| `CLAUDE_FAST_MODEL` | Modèle utilisé pour la validation et la détection des skills (par défaut `claude-haiku-5-5`) |
| `NEXT_PUBLIC_REMOTION_LICENSE_KEY` | Clé de licence Remotion pour le rendu dans le navigateur (voir ci-dessous) |
| `REMOTION_BROWSER` | Chemin vers Chromium pour le rendu en ligne de commande (facultatif) |

## Licence Remotion ⚠️

Remotion est **gratuit pour les particuliers et les entreprises de 3 personnes au maximum**. Au-delà,
une licence entreprise est obligatoire. Voir https://remotion.dev/license.

## Musiques

Les 4 pistes de `public/music/` sont **synthétisées par `scripts/make-music.py`** (numpy + ffmpeg, aucun échantillon
externe) : elles sont libres de droits. Pour les régénérer : `python3 scripts/make-music.py`.
Une musique importée par l'utilisateur reste sous sa responsabilité (droits d'auteur).
