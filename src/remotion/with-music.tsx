import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";

/**
 * Habille l'animation générée avec la piste musicale du projet :
 * boucle, fondu d'entrée (0,3 s) et de sortie (1 s).
 * Utilisé par l'aperçu, le rendu navigateur et le rendu en ligne de commande.
 */
export function withMusic(
  Component: React.ComponentType,
  src: string | null,
  volume: number,
): React.ComponentType {
  if (!src) return Component;
  const vol = Math.min(1, Math.max(0, volume));

  const WithMusic: React.FC = () => {
    const { fps, durationInFrames } = useVideoConfig();
    const fadeIn = Math.max(1, Math.round(0.3 * fps));
    const fadeOut = Math.max(1, Math.min(Math.round(fps), Math.floor(durationInFrames / 3)));
    return (
      <AbsoluteFill>
        <Component />
        <Audio
          src={src}
          loop
          // la courbe de volume suit la vidéo entière, pas chaque répétition de la boucle
          loopVolumeCurveBehavior="extend"
          volume={(f) =>
            interpolate(
              f,
              [0, fadeIn, durationInFrames - fadeOut, durationInFrames],
              [0, vol, vol, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )
          }
        />
      </AbsoluteFill>
    );
  };
  WithMusic.displayName = "WithMusic";
  return WithMusic;
}
