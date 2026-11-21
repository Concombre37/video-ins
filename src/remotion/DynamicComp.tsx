import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  cancelRender,
  getInputProps,
  getRemotionEnvironment,
  staticFile,
} from "remotion";
import { setActiveBrand } from "./active-brand";
import { isSpaceId } from "../lib/spaces";
import { setSource, type SourceMedia } from "./source-media";
import { compileCode } from "./compiler";
import { setProductImages } from "./product-images";
import { withMusic } from "./with-music";

interface DynamicCompProps {
  code: string;
  [key: string]: unknown;
}

export const DynamicComp: React.FC = () => {
  const { code, productImages, musicSrc, musicVolume, space, source } = getInputProps() as DynamicCompProps & {
    productImages?: string[];
    musicSrc?: string | null;
    musicVolume?: number;
    space?: string;
    /** rendu serveur d'une retouche : fichier d'origine copié dans le dossier public du rendu */
    source?: (Omit<SourceMedia, "src"> & { file: string }) | null;
  };
  // Rendu serveur : identité de l'espace et média d'origine
  if (isSpaceId(space)) setActiveBrand(space);
  if (source?.file) setSource({ ...source, src: staticFile(source.file) });
  // Rendu CLI / Lambda : les photos produits arrivent via les props
  if (Array.isArray(productImages) && productImages.length > 0) {
    setProductImages(productImages);
  }

  const [handle] = useState(() => delayRender("Compiling code..."));
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const result = compileCode(code);

      if (result.error) {
        // rendu serveur : échouer franchement plutôt que de livrer une vidéo d'erreur
        if (getRemotionEnvironment().isRendering) cancelRender(new Error(`Compilation : ${result.error}`));
        setError(result.error);
      } else {
        const Comp = result.Component;
        setComponent(() =>
          Comp ? withMusic(Comp, musicSrc ?? null, musicVolume ?? 0.6) : null,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      continueRender(handle);
    }
  }, [code, handle, musicSrc, musicVolume]);

  if (error) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#1a1a2e",
          justifyContent: "center",
          alignItems: "center",
          padding: 60,
        }}
      >
        <div
          style={{
            color: "#ff6b6b",
            fontSize: 42,
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            maxWidth: "80%",
          }}
        >
          Compilation Error
        </div>
        <div
          style={{
            color: "#fff",
            fontSize: 24,
            fontFamily: "monospace",
            marginTop: 24,
            textAlign: "center",
            maxWidth: "80%",
            wordBreak: "break-word",
          }}
        >
          {error}
        </div>
      </AbsoluteFill>
    );
  }

  if (!Component) {
    return null;
  }

  return <Component />;
};
