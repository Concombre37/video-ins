---
title: Product Photo Showcase
impact: HIGH
tags: product, photos, e-commerce, catalogue, PRODUCT_IMAGES, images
---

## Afficher les photos produits (PRODUCT_IMAGES)

PRODUCT_IMAGES est un tableau global (sans import). Toujours vérifier sa longueur.

```tsx
const PHOTOS = PRODUCT_IMAGES.length > 0 ? PRODUCT_IMAGES : [];
const BEAT = Math.round(fps * 2); // 2 s par photo
```

**Fond flou + photo nette** (marche pour toute orientation de photo) :

```tsx
<AbsoluteFill>
  <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(0.5)", transform: "scale(1.2)" }} />
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
    <Img src={src} style={{ width: "88%", height: "62%", objectFit: "contain", transform: `scale(${zoom})` }} />
  </AbsoluteFill>
</AbsoluteFill>
```

**Ken Burns** : `const zoom = interpolate(localFrame, [0, BEAT], [1, 1.12], { extrapolateRight: "clamp" })`.
Alterner zoom avant / arrière et décalage translateX entre photos pour du dynamisme.

**Entrée** : spring sur scale (0.85 -> 1) + opacity, ou slide() via TransitionSeries.

Si PRODUCT_IMAGES est vide, utiliser un placeholder graphique (forme + texte "TON PRODUIT"), jamais d'URL inventée.
