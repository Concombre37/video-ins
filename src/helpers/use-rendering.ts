import { renderMediaOnWeb } from "@remotion/web-renderer";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import { CompositionProps } from "../../types/constants";
import { compileCode } from "../remotion/compiler";
import { VIDEO_FORMAT } from "../remotion/product-images";

export type State =
  | { status: "init" }
  | { status: "invoking" }
  | { renderId: string; bucketName: string; progress: number; status: "rendering" }
  | { renderId: string | null; status: "error"; error: Error }
  | { url: string; size: number; status: "done" };

/**
 * Rendu MP4 directement dans le navigateur (WebCodecs) : pas besoin d'AWS.
 * Les photos produits (PRODUCT_IMAGES) restent en mémoire côté navigateur,
 * elles sont donc disponibles pendant le rendu.
 * Utilisez Chrome / Edge récents.
 */
export const useRendering = (inputProps: z.infer<typeof CompositionProps>) => {
  const [state, setState] = useState<State>({ status: "init" });

  const renderMedia = useCallback(async () => {
    setState({ status: "invoking" });
    try {
      const { Component, error } = compileCode(inputProps.code);
      if (!Component) throw new Error(error ?? "Compilation impossible");
      setState({ status: "rendering", renderId: "web", bucketName: "", progress: 0 });
      const result = await renderMediaOnWeb({
        composition: {
          component: Component,
          id: "bf-short",
          width: VIDEO_FORMAT.width,
          height: VIDEO_FORMAT.height,
          fps: inputProps.fps,
          durationInFrames: inputProps.durationInFrames,
        },
        inputProps: {},
        container: "mp4",
        videoCodec: "h264",
        videoBitrate: "high",
        licenseKey: process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY ?? null,
        onProgress: ({ progress }) =>
          setState((cur) => (cur.status === "rendering" ? { ...cur, progress } : cur)),
      });
      const blob = await result.getBlob();
      setState({ status: "done", url: URL.createObjectURL(blob), size: blob.size });
    } catch (err) {
      setState({
        status: "error",
        renderId: null,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, [inputProps]);

  const undo = useCallback(() => setState({ status: "init" }), []);

  return useMemo(() => ({ renderMedia, state, undo }), [renderMedia, state, undo]);
};
