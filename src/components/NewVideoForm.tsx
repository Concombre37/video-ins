"use client";

import { ErrorDisplay } from "@/components/ErrorDisplay";
import { Button } from "@/components/ui/button";
import {
  DurationPicker,
  FormatPicker,
  ModelPicker,
  MusicPicker,
  OptionLabel,
} from "@/components/VideoOptions";
import { AD_TEMPLATES, type AdTemplate } from "@/examples/templates";
import { useImageAttachments } from "@/hooks/useImageAttachments";
import { setPendingVideo } from "@/lib/pending-video";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FORMAT,
  DEFAULT_MUSIC,
  DEFAULT_SECONDS,
  DEFAULT_VOLUME,
  type MusicChoice,
  type VideoFormat,
} from "@/lib/video-settings";
import { MODELS, type ModelId } from "@/types/generation";
import {
  Dices,
  Gamepad2,
  Gift,
  ImagePlus,
  MessageCircle,
  PenLine,
  Pickaxe,
  Sparkles,
  Tag,
  Ticket,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ICONS: Record<AdTemplate["icon"], LucideIcon> = {
  Tag,
  Gift,
  Pickaxe,
  Gamepad2,
  MessageCircle,
  Sparkles,
  Dices,
  Ticket,
};

function Step({ n, title, children, aside }: { n: number; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            {n}
          </span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function NewVideoForm() {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelId>(MODELS[0].id);
  const [format, setFormat] = useState<VideoFormat>(DEFAULT_FORMAT);
  const [seconds, setSeconds] = useState<number>(DEFAULT_SECONDS);
  const [music, setMusic] = useState<MusicChoice>(DEFAULT_MUSIC);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [isNavigating, setIsNavigating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    attachedImages,
    isDragging,
    fileInputRef,
    removeImage,
    handleFileSelect,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    canAddMore,
    error,
    clearError,
  } = useImageAttachments();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 5000);
    return () => clearTimeout(t);
  }, [error, clearError]);

  const pickTemplate = (t: AdTemplate | null) => {
    if (!t) {
      setTemplateId(null);
      setPrompt("");
    } else {
      setTemplateId(t.id);
      setPrompt(t.prompt);
      setFormat(t.format);
      setSeconds(t.seconds);
      setMusic({ kind: "track", id: t.music });
    }
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isNavigating) return;
    setIsNavigating(true);
    setPendingVideo({
      prompt: prompt.trim(),
      model,
      format,
      seconds,
      music,
      volume,
      images: attachedImages,
      templateId: templateId ?? undefined,
    });
    router.push("/generate?new=1");
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <form onSubmit={submit} className="mx-auto w-full max-w-5xl px-6 py-10 flex flex-col gap-10">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Crée une pub vidéo <span className="text-primary">HytLabs</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Choisis un modèle ou décris ta vidéo : Claude l&apos;anime avec le logo et les couleurs HytLabs,
            tu la retouches en discutant, puis tu l&apos;exportes en MP4 avec musique.
          </p>
        </div>

        <Step n={1} title="Choisis un modèle" aside={<span className="text-xs text-muted-foreground-dim">Les prix et dates sont des exemples à adapter</span>}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <button
              type="button"
              onClick={() => pickTemplate(null)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
                templateId === null
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background-elevated hover:border-primary/50",
              )}
            >
              <PenLine className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-foreground">Partir de zéro</span>
              <span className="text-xs text-muted-foreground">Décris toi-même ta vidéo</span>
            </button>
            {AD_TEMPLATES.map((t) => {
              const Icon = ICONS[t.icon];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTemplate(t)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
                    templateId === t.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background-elevated hover:border-primary/50",
                  )}
                >
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{t.title}</span>
                  <span className="text-xs text-muted-foreground leading-snug">{t.description}</span>
                  <span className="mt-auto text-[10px] text-muted-foreground-dim">
                    {t.format} · {t.seconds} s
                  </span>
                </button>
              );
            })}
          </div>
        </Step>

        <Step n={2} title="Décris ta vidéo">
          <div
            className={cn(
              "rounded-xl border bg-background-elevated p-4 transition-colors",
              isDragging ? "border-primary bg-primary/10" : "border-border",
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {error && (
              <ErrorDisplay error={error} variant="inline" size="md" onDismiss={clearError} className="mb-3" />
            )}
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
              }}
              placeholder={
                isDragging
                  ? "Dépose tes images ici…"
                  : "Ex. : Pub pour nos serveurs Palworld, -25 % ce week-end, ambiance aventure, fin avec le logo et hytlabs.com"
              }
              className="w-full min-h-[150px] max-h-[360px] resize-y bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground-dim focus:outline-none"
              disabled={isNavigating}
            />
            {attachedImages.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pt-2">
                {attachedImages.map((img, i) => (
                  <div key={i} className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={`Image ${i + 1}`} className="h-20 w-auto rounded-md border border-border object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 rounded-full border border-border bg-background p-0.5 hover:bg-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canAddMore || isNavigating}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <ImagePlus className="w-4 h-4" />
                Ajouter des images (captures de jeu, visuels…) : elles apparaîtront dans la vidéo
              </button>
              <span className="hidden md:inline text-[11px] text-muted-foreground-dim">Ctrl + Entrée pour générer</span>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
          </div>
        </Step>

        <Step n={3} title="Réglages">
          <div className="grid gap-5 rounded-xl border border-border bg-background-elevated/60 p-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <OptionLabel>Format</OptionLabel>
              <FormatPicker value={format} onChange={setFormat} />
            </div>
            <div className="flex flex-col gap-2">
              <OptionLabel>Durée</OptionLabel>
              <DurationPicker value={seconds} onChange={setSeconds} />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <OptionLabel>Musique</OptionLabel>
              <MusicPicker value={music} onChange={setMusic} volume={volume} onVolumeChange={setVolume} />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <OptionLabel>Modèle d&apos;IA</OptionLabel>
              <ModelPicker value={model} onChange={setModel} />
            </div>
          </div>
        </Step>

        <div className="flex flex-col items-center gap-2 pb-4">
          <Button
            type="submit"
            size="lg"
            disabled={!prompt.trim() || isNavigating}
            loading={isNavigating}
            className="h-12 px-8 text-base bg-primary text-primary-foreground hover:bg-primary-hover"
          >
            <Wand2 className="w-5 h-5 mr-2" />
            Générer la vidéo
          </Button>
          <span className="text-xs text-muted-foreground-dim">
            Le coût exact de chaque génération s&apos;affiche dans l&apos;éditeur et dans l&apos;historique.
          </span>
        </div>
      </form>
    </main>
  );
}
