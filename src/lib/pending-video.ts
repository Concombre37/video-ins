"use client";

import type { MusicChoice, VideoFormat } from "@/lib/video-settings";
import type { ModelId } from "@/types/generation";

/**
 * Demande préparée sur la page d'accueil, transmise à l'éditeur lors de la navigation
 * (en mémoire : les photos et la musique importée sont trop lourdes pour l'URL).
 */
export interface PendingVideo {
  prompt: string;
  model: ModelId;
  format: VideoFormat;
  seconds: number;
  music: MusicChoice;
  volume: number;
  images: string[];
  templateId?: string;
}

let pending: PendingVideo | null = null;

export function setPendingVideo(p: PendingVideo) {
  pending = p;
}

/** Récupère la demande une seule fois (null si la page a été rechargée). */
export function takePendingVideo(): PendingVideo | null {
  const p = pending;
  pending = null;
  return p;
}
