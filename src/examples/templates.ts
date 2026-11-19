import type { MusicTrackId, VideoFormat } from "@/lib/video-settings";

/**
 * Modèles de pubs HytLabs prêts à l'emploi : ils pré-remplissent la demande et les réglages.
 * Les chiffres (prix, réductions, dates) sont des exemples à adapter avant de générer.
 */
export interface AdTemplate {
  id: string;
  title: string;
  description: string;
  icon: "Tag" | "Gift" | "Pickaxe" | "Gamepad2" | "MessageCircle" | "Sparkles" | "Dices" | "Ticket";
  format: VideoFormat;
  seconds: number;
  music: MusicTrackId;
  prompt: string;
}

export const AD_TEMPLATES: AdTemplate[] = [
  {
    id: "black-friday",
    title: "Black Friday",
    description: "Grosse réduction, compte à rebours, appel à l'action",
    icon: "Tag",
    format: "9:16",
    seconds: 10,
    music: "energique",
    prompt: `Pub Black Friday HytLabs.
Scène 1 : accroche "BLACK FRIDAY" énorme qui claque à l'écran, avec le symbole HytLabs.
Scène 2 : "-30 %" très gros en jaune Black Friday, sous-titre "sur tous les serveurs de jeux".
Scène 3 : 3 avantages qui arrivent l'un après l'autre avec une coche : "Serveur prêt en 1 minute", "Anti-DDoS inclus", "Support en français".
Scène 4 : "Jusqu'au 1er décembre seulement", puis le logo HytLabs complet, "hytlabs.com" et un bouton "Commander maintenant" qui pulse.
Style : fond nuit, accents violet et jaune, transitions rapides et percutantes.`,
  },
  {
    id: "minecraft",
    title: "Serveur Minecraft",
    description: "Prix, specs et versions supportées",
    icon: "Pickaxe",
    format: "9:16",
    seconds: 10,
    music: "gaming",
    prompt: `Pub pour les serveurs Minecraft HytLabs.
Scène 1 : accroche "Ton serveur Minecraft en 1 minute" avec un effet de blocs qui s'empilent (carrés façon pixels).
Scène 2 : les points forts en cartes : "Paper, Forge, Fabric, modpacks FTB", "Jusqu'à 16 Go de RAM", "Panel simple pour gérer ton serveur".
Scène 3 : le prix "À partir de 4,99 € / mois" bien en évidence.
Scène 4 : logo HytLabs complet + "hytlabs.com" + bouton "Créer mon serveur".
Style : dynamique, esprit jeu vidéo, couleurs de la marque.`,
  },
  {
    id: "christmas",
    title: "Calendrier de l'Avent",
    description: "Un cadeau par jour du 1er au 24 décembre",
    icon: "Gift",
    format: "9:16",
    seconds: 12,
    music: "epique",
    prompt: `Pub du calendrier de l'Avent HytLabs.
Scène 1 : accroche "Le calendrier de l'Avent HytLabs est ouvert" avec des flocons qui tombent doucement.
Scène 2 : une grille de cases numérotées de 1 à 24 qui s'ouvrent une par une (rapidement), certaines révèlent un cadeau.
Scène 3 : "Chaque jour : un cadeau à gagner (crédits, réductions, serveurs offerts)".
Scène 4 : "Du 1er au 24 décembre", logo HytLabs complet, "hytlabs.com".
Style : festif mais élégant, fond nuit, touches de violet et d'or.`,
  },
  {
    id: "new-game",
    title: "Nouveau jeu",
    description: "Annonce d'un jeu ajouté au catalogue",
    icon: "Gamepad2",
    format: "9:16",
    seconds: 10,
    music: "epique",
    prompt: `Annonce : un nouveau jeu est disponible chez HytLabs.
Scène 1 : "NOUVEAU" qui apparaît avec un flash, puis le nom du jeu "Valheim" en très gros.
Scène 2 : "Héberge ton serveur Valheim en quelques clics", avec 3 points : "Installation automatique", "Sauvegardes quotidiennes", "Joue avec tes amis 24 h/24".
Scène 3 : "À partir de 6,99 € / mois".
Scène 4 : logo HytLabs complet + "hytlabs.com".
Style : cinématique, annonce importante, montée en intensité.`,
  },
  {
    id: "discord",
    title: "Rejoins le Discord",
    description: "Faire venir la communauté sur le serveur Discord",
    icon: "MessageCircle",
    format: "1:1",
    seconds: 8,
    music: "chill",
    prompt: `Pub pour rejoindre le Discord HytLabs.
Scène 1 : "Rejoins la communauté HytLabs" avec des bulles de discussion qui apparaissent.
Scène 2 : ce qu'on y trouve : "Support rapide", "Annonces et promos en avant-première", "Concours et cadeaux".
Scène 3 : le lien "discord.gg/sY9k32Mb4q" bien lisible, logo HytLabs complet.
Style : convivial, animations douces, couleurs de la marque.`,
  },
  {
    id: "daily-wheel",
    title: "Roulette quotidienne",
    description: "Tourner la roue chaque jour pour gagner",
    icon: "Dices",
    format: "9:16",
    seconds: 8,
    music: "gaming",
    prompt: `Pub pour la roulette quotidienne HytLabs.
Scène 1 : "Tente ta chance chaque jour" et une roue colorée qui tourne vite puis ralentit.
Scène 2 : la roue s'arrête sur "Crédits offerts !" avec une explosion de confettis.
Scène 3 : "Un tour gratuit par jour sur ton espace client", logo HytLabs complet, "hytlabs.com".
Style : fun, rythmé, couleurs violet et jaune.`,
  },
  {
    id: "promo-code",
    title: "Code promo",
    description: "Annonce courte d'un code de réduction",
    icon: "Ticket",
    format: "9:16",
    seconds: 6,
    music: "energique",
    prompt: `Pub courte pour un code promo HytLabs.
Scène 1 : "-20 % sur ton premier mois" qui arrive en force.
Scène 2 : le code "HYT20" dans un ticket qui se découpe, avec un effet de brillance.
Scène 3 : logo HytLabs complet + "hytlabs.com" + "Valable jusqu'au 31 décembre".
Style : très rapide, percutant.`,
  },
  {
    id: "presentation",
    title: "Présentation HytLabs",
    description: "Pourquoi choisir HytLabs, format YouTube",
    icon: "Sparkles",
    format: "16:9",
    seconds: 15,
    music: "energique",
    prompt: `Vidéo de présentation de HytLabs, hébergeur de serveurs de jeux.
Scène 1 : logo HytLabs complet qui se construit à l'écran, puis "L'hébergement de serveurs de jeux, simplement".
Scène 2 : les jeux disponibles qui défilent : Minecraft, Valheim, Palworld, Rust, ARK, Satisfactory.
Scène 3 : 4 atouts en grille : "Prêt en 1 minute", "Protection anti-DDoS", "Serveurs en France", "Support en français".
Scène 4 : "À partir de 4,99 € / mois", logo HytLabs complet, "hytlabs.com", bouton "Découvrir les offres".
Style : professionnel et moderne, mise en page horizontale aérée.`,
  },
];
