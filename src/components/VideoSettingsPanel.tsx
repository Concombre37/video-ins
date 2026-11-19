"use client";

import { Button } from "@/components/ui/button";
import {
  DurationPicker,
  FormatPicker,
  ModelPicker,
  MusicPicker,
  OptionLabel,
} from "@/components/VideoOptions";
import { usd, type MusicChoice, type VideoFormat } from "@/lib/video-settings";
import type { ModelId } from "@/types/generation";
import { Coins, SlidersHorizontal, Wand2 } from "lucide-react";

interface Props {
  format: VideoFormat;
  onFormatChange: (f: VideoFormat) => void;
  seconds: number;
  onSecondsChange: (s: number) => void;
  music: MusicChoice;
  onMusicChange: (m: MusicChoice) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  model: ModelId;
  onModelChange: (m: ModelId) => void;
  /** Format ou durée modifiés depuis la dernière génération */
  needsAdapt: string | null;
  onAdapt: () => void;
  busy: boolean;
  projectCost: number;
  generations: number;
}

/** Colonne de droite de l'éditeur : réglages de la vidéo et coût du projet. */
export function VideoSettingsPanel(p: Props) {
  return (
    <aside className="flex w-full flex-col gap-5 overflow-y-auto rounded-xl border border-border bg-background-elevated/50 p-4 min-[1100px]:w-[300px] min-[1100px]:shrink-0">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <SlidersHorizontal className="w-4 h-4 text-primary" />
        Réglages de la vidéo
      </h2>

      <div className="flex flex-col gap-2">
        <OptionLabel>Format</OptionLabel>
        <FormatPicker value={p.format} onChange={p.onFormatChange} disabled={p.busy} compact />
      </div>

      <div className="flex flex-col gap-2">
        <OptionLabel>Durée</OptionLabel>
        <DurationPicker value={p.seconds} onChange={p.onSecondsChange} disabled={p.busy} />
      </div>

      {p.needsAdapt && (
        <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="text-xs leading-relaxed text-foreground">
            {p.needsAdapt} L&apos;animation a été écrite pour l&apos;ancien réglage : demande à Claude de l&apos;adapter.
          </p>
          <Button size="sm" onClick={p.onAdapt} disabled={p.busy} className="bg-primary text-primary-foreground hover:bg-primary-hover">
            <Wand2 className="w-4 h-4" />
            Adapter avec Claude
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <OptionLabel>Musique</OptionLabel>
        <MusicPicker
          value={p.music}
          onChange={p.onMusicChange}
          volume={p.volume}
          onVolumeChange={p.onVolumeChange}
        />
      </div>

      <div className="flex flex-col gap-2">
        <OptionLabel>Modèle pour les retouches</OptionLabel>
        <ModelPicker value={p.model} onChange={p.onModelChange} disabled={p.busy} compact />
      </div>

      <div className="mt-auto flex items-center gap-3 rounded-lg border border-border bg-background/60 p-3">
        <Coins className="w-5 h-5 shrink-0 text-primary" />
        <div className="text-xs">
          <div className="font-semibold text-foreground">Coût de ce projet : {usd(p.projectCost)}</div>
          <div className="text-muted-foreground">
            {p.generations} génération{p.generations > 1 ? "s" : ""} et retouche{p.generations > 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </aside>
  );
}
