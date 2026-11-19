"use client";

import { ErrorDisplay } from "@/components/ErrorDisplay";
import { Button } from "@/components/ui/button";
import { captureFrame } from "@/helpers/capture-frame";
import { useImageAttachments } from "@/hooks/useImageAttachments";
import { FORMATS, type VideoFormat } from "@/lib/video-settings";
import { markCaptured } from "@/remotion/product-images";
import { ArrowUp, Camera, ImagePlus, X } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";

interface ChatInputProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  isLoading: boolean;
  onSubmit: (attachedImages?: string[]) => void;
  Component?: ComponentType | null;
  fps?: number;
  durationInFrames?: number;
  currentFrame?: number;
  format: VideoFormat;
}

export function ChatInput({
  prompt,
  onPromptChange,
  isLoading,
  onSubmit,
  Component,
  fps = 30,
  durationInFrames = 300,
  currentFrame = 0,
  format,
}: ChatInputProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const {
    attachedImages,
    isDragging,
    fileInputRef,
    addImages,
    removeImage,
    clearImages,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onSubmit(attachedImages.length > 0 ? attachedImages : undefined);
    clearImages();
  };

  const handleCapture = async () => {
    if (!Component || isCapturing || !canAddMore) return;
    setIsCapturing(true);
    try {
      const base64 = await captureFrame(Component, currentFrame, {
        width: FORMATS[format].width,
        height: FORMATS[format].height,
        fps,
        durationInFrames,
      });
      markCaptured(base64);
      addImages([base64]);
    } catch (err) {
      console.error("Capture impossible :", err);
    } finally {
      setIsCapturing(false);
    }
  };

  const canCapture = Component && !isLoading && !isCapturing && canAddMore;

  return (
    <div className="px-4 pb-4 pt-2">
      <form onSubmit={handleSubmit}>
        <div
          className={`rounded-xl border bg-background-elevated p-3 transition-colors ${
            isDragging ? "border-primary bg-primary/10" : "border-border focus-within:border-primary/60"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {error && (
            <ErrorDisplay error={error} variant="inline" size="sm" onDismiss={clearError} className="mb-2 py-2" />
          )}

          {attachedImages.length > 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1 pt-2">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={`Image ${i + 1}`} className="h-14 w-14 rounded border border-border object-cover" />
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

          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            onPaste={handlePaste}
            placeholder={isDragging ? "Dépose tes images ici…" : "Une retouche ? Ex. : « le prix plus gros »"}
            className="w-full min-h-[40px] max-h-[140px] resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground-dim focus:outline-none"
            style={{ fieldSizing: "content" } as React.CSSProperties}
            disabled={isLoading}
          />
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />

          <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || !canAddMore}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                title="Ajouter des images (elles peuvent apparaître dans la vidéo)"
              >
                <ImagePlus className="w-4 h-4" />
                Image
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canCapture}
                onClick={handleCapture}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                title="Envoyer à Claude l'image actuellement affichée dans l'aperçu"
              >
                <Camera className="w-4 h-4" />
                Capture
              </Button>
            </div>
            <Button
              type="submit"
              size="icon-sm"
              disabled={!prompt.trim() || isLoading}
              loading={isLoading}
              className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary-hover"
              title="Envoyer (Entrée)"
            >
              <ArrowUp className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
