"use client";

import { FORMATS, type VideoFormat } from "@/lib/video-settings";
import { withMusic } from "@/remotion/with-music";
import { Player, type ErrorFallback, type PlayerRef } from "@remotion/player";
import { Loader2, Sparkles } from "lucide-react";
import React, { useEffect, useMemo, useRef } from "react";
import { ErrorDisplay, type ErrorType } from "../ErrorDisplay";
import { RenderControls } from "./RenderControls";

const errorTitles: Record<ErrorType, string> = {
  validation: "Demande refusée",
  api: "Erreur de génération",
  compilation: "Erreur dans le code",
};

const renderErrorFallback: ErrorFallback = ({ error }) => (
  <ErrorDisplay
    error={error.message || "Erreur pendant la lecture de l'animation"}
    title="Erreur à l'exécution"
    variant="fullscreen"
    size="lg"
  />
);

interface AnimationPlayerProps {
  Component: React.ComponentType | null;
  durationInFrames: number;
  fps: number;
  format: VideoFormat;
  musicSrc: string | null;
  volume: number;
  isCompiling: boolean;
  isStreaming: boolean;
  error: string | null;
  errorType?: ErrorType;
  code: string;
  onRuntimeError?: (error: string) => void;
  onFrameChange?: (frame: number) => void;
}

/** Cadre aux proportions du format, centré dans l'espace disponible. */
function Frame({ format, children, className = "" }: { format: VideoFormat; children: React.ReactNode; className?: string }) {
  const f = FORMATS[format];
  const landscape = f.width >= f.height;
  return (
    <div className="flex flex-1 min-h-0 items-center justify-center">
      <div
        className={`relative overflow-hidden rounded-xl border border-border-dim bg-background-elevated shadow-[0_0_80px_rgba(111,92,241,0.15)] ${className}`}
        style={{
          aspectRatio: `${f.width} / ${f.height}`,
          width: landscape ? "100%" : "auto",
          height: landscape ? "auto" : "100%",
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export const AnimationPlayer: React.FC<AnimationPlayerProps> = ({
  Component,
  durationInFrames,
  fps,
  format,
  musicSrc,
  volume,
  isCompiling,
  isStreaming,
  error,
  errorType = "compilation",
  code,
  onRuntimeError,
  onFrameChange,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const f = FORMATS[format];

  // L'aperçu joue la musique du projet (fondus compris)
  const Composed = useMemo(
    () => (Component ? withMusic(Component, musicSrc, volume) : null),
    [Component, musicSrc, volume],
  );
  // Nouvelle instance du lecteur à chaque nouvelle animation
  const playerKey = useMemo(() => (Component ? Math.random().toString(36) : "vide"), [Component]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !onRuntimeError) return;
    const handleError = (e: { detail: { error: Error } }) => onRuntimeError(e.detail.error.message);
    player.addEventListener("error", handleError);
    return () => player.removeEventListener("error", handleError);
  }, [onRuntimeError, Composed]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !onFrameChange) return;
    const handleFrameUpdate = (e: { detail: { frame: number } }) => onFrameChange(e.detail.frame);
    player.addEventListener("frameupdate", handleFrameUpdate);
    return () => player.removeEventListener("frameupdate", handleFrameUpdate);
  }, [onFrameChange, Composed]);

  let content: React.ReactNode;
  if (isStreaming) {
    content = (
      <Frame format={format}>
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
          <Sparkles className="w-8 h-8 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Claude écrit ton animation…</p>
        </div>
      </Frame>
    );
  } else if (isCompiling) {
    content = (
      <Frame format={format}>
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Frame>
    );
  } else if (error) {
    content = (
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <ErrorDisplay error={error} title={errorTitles[errorType]} variant="fullscreen" size="lg" />
      </div>
    );
  } else if (!Composed) {
    content = (
      <Frame format={format}>
        <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-muted-foreground-dim">
          La vidéo apparaîtra ici
        </div>
      </Frame>
    );
  } else {
    content = (
      <Frame format={format}>
        <Player
          ref={playerRef}
          key={playerKey}
          component={Composed}
          durationInFrames={durationInFrames}
          fps={fps}
          compositionWidth={f.width}
          compositionHeight={f.height}
          style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
          controls
          autoPlay
          loop
          errorFallback={renderErrorFallback}
          spaceKeyToPlayOrPause={false}
          clickToPlay={false}
          initiallyMuted
        />
      </Frame>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-4">
      {content}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <RenderControls
          code={code}
          durationInFrames={durationInFrames}
          fps={fps}
          format={format}
          musicSrc={musicSrc}
          volume={volume}
          disabled={!Composed || isStreaming || isCompiling || Boolean(error)}
        />
        {Composed && (
          <span className="text-xs text-muted-foreground-dim">
            {f.width}×{f.height} · {(durationInFrames / fps).toFixed(1).replace(".", ",")} s
            {musicSrc ? " · son coupé par défaut dans l'aperçu (icône haut-parleur)" : ""}
          </span>
        )}
      </div>
    </div>
  );
};
