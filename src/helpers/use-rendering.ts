import { renderMediaOnWeb } from "@remotion/web-renderer";
import { useCallback, useMemo, useState } from "react";
import { getSavedProjectId, saveCurrentProject } from "../lib/current-project";
import { FORMATS, type VideoFormat } from "../lib/video-settings";
import { compileCode } from "../remotion/compiler";
import { withMusic } from "../remotion/with-music";

export interface RenderInput {
  code: string;
  durationInFrames: number;
  fps: number;
  format: VideoFormat;
  musicSrc: string | null;
  volume: number;
}

export type RenderState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "rendering"; progress: number }
  | { status: "error"; message: string }
  | {
      status: "done";
      url: string;
      size: number;
      archived: "saving" | "ok" | "failed";
    };

/** Message lisible pour les erreurs de rendu les plus courantes. */
function explain(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/webcodecs|VideoEncoder|not supported|unsupported/i.test(msg)) {
    return `Ton navigateur ne sait pas encoder la vidéo (${msg}). Utilise Chrome ou Edge à jour sur ordinateur.`;
  }
  return msg;
}

/**
 * Rendu MP4 directement dans le navigateur (WebCodecs, Chrome / Edge), musique comprise,
 * puis archivage du fichier dans l'historique du projet.
 */
export const useRendering = (input: RenderInput) => {
  const [state, setState] = useState<RenderState>({ status: "idle" });

  const render = useCallback(async () => {
    setState({ status: "preparing" });
    try {
      const { Component, error } = compileCode(input.code);
      if (!Component) throw new Error(error ?? "Le code de la vidéo ne compile pas.");
      const f = FORMATS[input.format];
      const composition = {
        component: withMusic(Component, input.musicSrc, input.volume),
        id: "hytlabs-short",
        width: f.width,
        height: f.height,
        fps: input.fps,
        durationInFrames: input.durationInFrames,
      };
      setState({ status: "rendering", progress: 0 });
      const onProgress = ({ progress }: { progress: number }) =>
        setState((cur) => (cur.status === "rendering" ? { ...cur, progress } : cur));

      let result;
      try {
        result = await renderMediaOnWeb({
          composition,
          inputProps: {},
          container: "mp4",
          videoCodec: "h264",
          videoBitrate: "high",
          licenseKey: process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY ?? null,
          onProgress,
        });
      } catch (firstError) {
        // Certains navigateurs n'encodent pas l'AAC : nouvel essai en Opus
        if (!input.musicSrc || !/audio|aac/i.test(String(firstError))) throw firstError;
        result = await renderMediaOnWeb({
          composition,
          inputProps: {},
          container: "mp4",
          videoCodec: "h264",
          audioCodec: "opus",
          videoBitrate: "high",
          licenseKey: process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY ?? null,
          onProgress,
        });
      }
      const blob = await result.getBlob();
      setState({ status: "done", url: URL.createObjectURL(blob), size: blob.size, archived: "saving" });

      // Archive le MP4 dans l'historique du projet
      let archived: "ok" | "failed" = "failed";
      try {
        await saveCurrentProject();
        const id = getSavedProjectId();
        if (id) {
          const res = await fetch(`/api/history/${id}/renders`, {
            method: "POST",
            headers: { "Content-Type": "video/mp4" },
            body: blob,
          });
          if (res.ok) archived = "ok";
        }
      } catch {
        // le téléchargement local reste possible
      }
      setState((cur) => (cur.status === "done" ? { ...cur, archived } : cur));
    } catch (err) {
      setState({ status: "error", message: explain(err) });
    }
  }, [input]);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return useMemo(() => ({ render, state, reset }), [render, state, reset]);
};
