"use client";

import { Button } from "@/components/ui/button";
import { useRendering, type RenderInput } from "@/helpers/use-rendering";
import { Check, Download, Film, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;

/** Export MP4 : bouton, progression, téléchargement et état de l'archivage. */
export const RenderControls: React.FC<RenderInput & { disabled?: boolean }> = ({ disabled, ...input }) => {
  const { render, state, reset } = useRendering(input);
  const key = JSON.stringify([input.code, input.durationInFrames, input.fps, input.format, input.musicSrc, input.volume]);
  const prevKey = useRef(key);

  // Un rendu terminé ne correspond plus à la vidéo dès qu'un réglage change
  useEffect(() => {
    if (prevKey.current !== key && state.status !== "idle" && state.status !== "rendering") reset();
    prevKey.current = key;
  }, [key, state.status, reset]);

  if (state.status === "rendering" || state.status === "preparing") {
    const pct = state.status === "rendering" ? Math.round(state.progress * 100) : 0;
    return (
      <div className="flex w-full max-w-md flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {state.status === "preparing" ? "Préparation…" : "Export en cours (garde l'onglet ouvert)"}
          </span>
          <span className="font-medium tabular-nums">{pct} %</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  if (state.status === "done") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <a href={state.url} download={`hytlabs-${input.format.replace(":", "x")}-${Date.now()}.mp4`}>
          <Button className="bg-primary text-primary-foreground hover:bg-primary-hover">
            <Download className="w-4 h-4" />
            Télécharger le MP4
            <span className="opacity-70">{mb(state.size)}</span>
          </Button>
        </a>
        <Button variant="outline" onClick={reset} title="Refaire un export">
          <RotateCcw className="w-4 h-4" />
        </Button>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {state.archived === "saving" && (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ajout à l&apos;historique…
            </>
          )}
          {state.archived === "ok" && (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" /> Enregistrée dans l&apos;historique
            </>
          )}
          {state.archived === "failed" && "Non enregistrée dans l'historique"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={render}
        disabled={disabled || !input.code}
        className="bg-primary text-primary-foreground hover:bg-primary-hover"
      >
        <Film className="w-4 h-4" />
        Exporter en MP4
      </Button>
      {state.status === "error" && (
        <p className="flex max-w-md items-start gap-1.5 text-xs text-red-400">
          <TriangleAlert className="mt-0.5 w-3.5 h-3.5 shrink-0" />
          {state.message}
        </p>
      )}
    </div>
  );
};
