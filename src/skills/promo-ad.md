---
title: Promo / Black Friday Ad
impact: HIGH
tags: black friday, cyber monday, sale, promo, discount, ad, soldes, réduction
---

## Structure d'une pub courte qui convertit (6-15 s, 9:16)

1. **Hook (0-1.5 s)** : énorme texte choc ("BLACK FRIDAY", "-50%", "C'EST MAINTENANT") avec un impact
   visuel (scale spring de 2.5 -> 1, flash blanc d'1-2 frames, léger shake).
2. **Produit (1.5-8 s)** : une photo par beat de 1.5-2.5 s (PRODUCT_IMAGES), zoom lent (Ken Burns 1 -> 1.12),
   nom du produit + prix barré -> nouveau prix.
3. **Urgence** : compte à rebours, "Stock limité", "48H SEULEMENT".
4. **CTA (2 dernières secondes)** : "LIEN EN BIO" / "COMMANDE MAINTENANT" avec pulse (scale 1 -> 1.06 en boucle).

## Codes visuels Black Friday

- Palette : fond #000 ou #0A0A0A, accent unique très saturé (jaune #FFD600, rouge #FF1E3C ou néon #00FFC8),
  texte blanc. Max 3 couleurs.
- Badge de réduction : cercle ou étoile (Star de @remotion/shapes) accent, texte noir, rotation -8° à 8°.
- Prix barré : ancien prix gris 60% d'opacité + ligne qui se dessine (width 0 -> 100% via interpolate),
  puis le nouveau prix arrive en spring avec l'accent.
- Fontes : fontWeight 900, letterSpacing -2, textTransform uppercase pour les titres.
- Bandeau défilant (marquee) "BLACK FRIDAY • -50% • BLACK FRIDAY •" via translateX = -(frame * 8) % largeurTexte.

## Règles

- Tout le texte modifiable en constantes en haut (TITLE_TEXT, OLD_PRICE, NEW_PRICE, DISCOUNT, CTA_TEXT).
- Lisible sans le son : chaque beat a un texte court (<= 5 mots).
- Ne jamais couvrir le produit à plus de 30% avec du texte.
- Utiliser Sequence ou TransitionSeries pour enchaîner les beats ; transitions rapides (6-10 frames).
