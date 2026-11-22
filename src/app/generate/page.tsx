"use client";

import { Loader2 } from "lucide-react";
import type { NextPage } from "next";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimationPlayer } from "../../components/AnimationPlayer";
import { ChatSidebar, type ChatSidebarRef } from "../../components/ChatSidebar";
import { CodeEditor } from "../../components/CodeEditor";
import { PageLayout } from "../../components/PageLayout";
import { setSource } from "../../remotion/source-media";
import { SpaceProvider } from "../../components/SpaceProvider";
import { TabPanel } from "../../components/TabPanel";
import { VideoSettingsPanel } from "../../components/VideoSettingsPanel";
import { useAnimationState } from "../../hooks/useAnimationState";
import { useAutoCorrection } from "../../hooks/useAutoCorrection";
import { useConversationState } from "../../hooks/useConversationState";
import {
  markProjectSaved,
  newProjectId,
  notifyBalanceChanged,
  registerProjectSaver,
  setCurrentProject,
} from "../../lib/current-project";
import { takePendingVideo } from "../../lib/pending-video";
import {
  clampSeconds,
  DEFAULT_FORMAT,
  DEFAULT_FPS,
  DEFAULT_MUSIC,
  DEFAULT_SECONDS,
  DEFAULT_VOLUME,
  FORMATS,
  isVideoFormat,
  musicSrc,
  parseMusic,
  type MusicChoice,
  type VideoFormat,
} from "../../lib/video-settings";
import { PRODUCT_IMAGES, setProductImages } from "../../remotion/product-images";
import type {
  AssistantMetadata,
  ConversationMessage,
  EditOperation,
  ErrorCorrectionContext,
} from "../../types/conversation";
import { MODELS, type GenerationErrorType, type ModelId, type StreamPhase } from "../../types/generation";

const MAX_CORRECTION_ATTEMPTS = 3;

interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  codeSnapshot?: string;
  model?: string;
  cost?: number;
  timestamp: number;
}

function GeneratePageContent() {
  const searchParams = useSearchParams();
  const projectParam = searchParams.get("project");
  // Ancien lien direct (?prompt=…) toujours accepté, pour les scripts et agents
  const urlPrompt = searchParams.get("prompt") || "";

  // Demande préparée sur la page d'accueil (lue une seule fois)
  const [pending] = useState(() => (projectParam ? null : takePendingVideo()));
  const initialPrompt = pending?.prompt || urlPrompt;
  const willAutoStart = Boolean(initialPrompt);

  // ---- Réglages de la vidéo ----
  const urlModel = MODELS.find((m) => m.id === searchParams.get("model"))?.id;
  const urlFormat = searchParams.get("format");
  const [model, setModel] = useState<ModelId>(pending?.model ?? urlModel ?? MODELS[0].id);
  const [format, setFormat] = useState<VideoFormat>(
    pending?.format ?? (isVideoFormat(urlFormat) ? urlFormat : DEFAULT_FORMAT),
  );
  const [seconds, setSeconds] = useState<number>(
    pending?.seconds ?? clampSeconds(Number(searchParams.get("seconds")) || DEFAULT_SECONDS),
  );
  const [fps, setFps] = useState(DEFAULT_FPS);
  const [music, setMusic] = useState<MusicChoice>(pending?.music ?? DEFAULT_MUSIC);
  const [volume, setVolume] = useState(pending?.volume ?? DEFAULT_VOLUME);
  const durationInFrames = Math.round(seconds * fps);
  const currentMusicSrc = useMemo(() => musicSrc(music), [music]);

  // Réglages utilisés lors de la dernière génération (pour proposer d'adapter l'animation)
  const [lastGenSettings, setLastGenSettings] = useState<{ format: VideoFormat; seconds: number } | null>(null);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isStreaming, setIsStreaming] = useState(willAutoStart);
  const [streamPhase, setStreamPhase] = useState<StreamPhase>(willAutoStart ? "reasoning" : "idle");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [generationError, setGenerationError] = useState<{
    message: string;
    type: GenerationErrorType;
    failedEdit?: EditOperation;
  } | null>(null);
  const [errorCorrection, setErrorCorrection] = useState<ErrorCorrectionContext | null>(null);

  const {
    messages,
    hasManualEdits,
    pendingMessage,
    addUserMessage,
    addAssistantMessage,
    addErrorMessage,
    markManualEdit,
    getFullContext,
    getPreviouslyUsedSkills,
    getLastUserAttachedImages,
    restoreMessages,
    setPendingMessage,
    clearPendingMessage,
    isFirstGeneration,
  } = useConversationState();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const { code, Component, error: compilationError, isCompiling, setCode, compileCode } = useAnimationState("");

  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const codeError = compilationError || runtimeError;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStreamingRef = useRef(isStreaming);
  const codeRef = useRef(code);
  const chatSidebarRef = useRef<ChatSidebarRef>(null);

  const { markAsAiGenerated, markAsUserEdited } = useAutoCorrection({
    maxAttempts: MAX_CORRECTION_ATTEMPTS,
    compilationError: codeError,
    generationError,
    isStreaming,
    isCompiling,
    hasGeneratedOnce,
    code,
    errorCorrection,
    onTriggerCorrection: useCallback(
      (correctionPrompt: string, context: ErrorCorrectionContext) => {
        setErrorCorrection(context);
        setPrompt(correctionPrompt);
        const lastImages = getLastUserAttachedImages();
        setTimeout(() => {
          chatSidebarRef.current?.triggerGeneration({ silent: true, attachedImages: lastImages });
        }, 100);
      },
      [getLastUserAttachedImages],
    ),
    onAddErrorMessage: addErrorMessage,
    onClearGenerationError: useCallback(() => setGenerationError(null), []),
    onClearErrorCorrection: useCallback(() => setErrorCorrection(null), []),
  });

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    const wasStreaming = isStreamingRef.current;
    isStreamingRef.current = isStreaming;
    if (wasStreaming && !isStreaming) {
      markAsAiGenerated();
      compileCode(codeRef.current);
    }
  }, [isStreaming, compileCode, markAsAiGenerated]);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      setHasGeneratedOnce(true);
      if (!isStreamingRef.current) {
        markManualEdit(newCode);
        markAsUserEdited();
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (isStreamingRef.current) return;
      debounceRef.current = setTimeout(() => compileCode(newCode), 500);
    },
    [setCode, compileCode, markManualEdit, markAsUserEdited],
  );

  const handleMessageSent = useCallback(
    (promptText: string, attachedImages?: string[]) => addUserMessage(promptText, attachedImages),
    [addUserMessage],
  );

  // Réglages au moment de l'envoi, pour savoir si l'animation correspond encore au format / à la durée
  const settingsRef = useRef({ format, seconds });
  settingsRef.current = { format, seconds };

  const handleGenerationComplete = useCallback(
    (generatedCode: string, summary?: string, metadata?: AssistantMetadata) => {
      addAssistantMessage(summary || "Vidéo générée. Une retouche ?", generatedCode, metadata);
      markAsAiGenerated();
      setLastGenSettings({ ...settingsRef.current });
    },
    [addAssistantMessage, markAsAiGenerated],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const handleStreamingChange = useCallback((streaming: boolean) => {
    setIsStreaming(streaming);
    if (streaming) {
      setGenerationError(null);
      setRuntimeError(null);
      setErrorCorrection(null);
    }
  }, []);

  const handleError = useCallback((message: string, type: GenerationErrorType, failedEdit?: EditOperation) => {
    setGenerationError({ message, type, failedEdit });
  }, []);

  const handleRuntimeError = useCallback((msg: string) => setRuntimeError(msg), []);

  // ---- Historique : identifiant du projet, sauvegarde après chaque génération ----
  const projectIdRef = useRef<string>("");
  const [loadingProject, setLoadingProject] = useState(Boolean(projectParam));
  if (!projectIdRef.current) {
    projectIdRef.current = projectParam || newProjectId();
    setCurrentProject(projectIdRef.current, Boolean(projectParam));
  }

  const saveStateRef = useRef({ messages, code, fps, durationInFrames, format, music, volume });
  saveStateRef.current = { messages, code, fps, durationInFrames, format, music, volume };

  const saveProject = useCallback(async () => {
    const st = saveStateRef.current;
    const stored: StoredMessage[] = st.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        codeSnapshot: m.codeSnapshot,
        model: m.metadata?.model,
        cost: m.metadata?.cost,
        timestamp: m.timestamp,
      }));
    if (stored.length === 0 || !st.code) return;
    const firstPrompt = stored.find((m) => m.role === "user")?.content ?? "Sans titre";
    const lastModel = [...stored].reverse().find((m) => m.model)?.model;
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: projectIdRef.current,
          title: firstPrompt,
          code: st.code,
          fps: st.fps,
          durationInFrames: st.durationInFrames,
          model: lastModel,
          messages: stored,
          productImages: [...PRODUCT_IMAGES],
          format: st.format,
          music: st.music,
          volume: st.volume,
        }),
      });
      if (res.ok) markProjectSaved();
    } catch {
      // l'historique ne doit jamais bloquer l'éditeur
    }
  }, []);

  useEffect(() => {
    registerProjectSaver(saveProject);
    return () => registerProjectSaver(null);
  }, [saveProject]);

  // Sauvegarde dès qu'une nouvelle réponse de Claude arrive
  const lastSavedMsgRef = useRef<string | null>(null);
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || loadingProject) return;
    if (lastSavedMsgRef.current === last.id) return;
    lastSavedMsgRef.current = last.id;
    saveProject();
    notifyBalanceChanged();
  }, [messages, saveProject, loadingProject]);

  // Les réglages (format, durée, musique) sont aussi enregistrés quand on les change
  const settingsKey = JSON.stringify([format, seconds, volume, music.kind === "custom" ? music.name : music]);
  useEffect(() => {
    if (loadingProject || messages.length === 0) return;
    const t = setTimeout(saveProject, 800);
    return () => clearTimeout(t);
  }, [settingsKey]);

  // Ouverture d'un projet depuis l'historique (?project=<id>)
  useEffect(() => {
    if (!projectParam) {
      setSource(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/history/${encodeURIComponent(projectParam)}`);
        if (!res.ok) throw new Error("Projet introuvable");
        const p = await res.json();
        if (cancelled) return;
        setProductImages(p.productImages ?? []);
        // projet de retouche : le média d'origine du client sert de fond (globale SOURCE)
        setSource(
          p.source
            ? {
                ...p.source,
                src: p.source.plate
                  ? `/api/media/${p.source.mediaId}/sources/${p.source.plate}`
                  : `/api/media/${p.source.mediaId}/file?v=${p.source.version}`,
                assets: Object.fromEntries(
                  ((p.source.assets ?? []) as string[]).map((n) => [n, `/api/media/${p.source.mediaId}/sources/${encodeURIComponent(n)}`]),
                ),
              }
            : null,
        );
        const restored: ConversationMessage[] = (p.messages ?? []).map((m: StoredMessage, i: number) => ({
          id: `${m.role}-restored-${i}`,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          codeSnapshot: m.codeSnapshot,
          metadata: m.model || m.cost != null ? { model: m.model, cost: m.cost } : undefined,
        }));
        const lastAssistant = [...restored].reverse().find((m) => m.role === "assistant");
        lastSavedMsgRef.current = lastAssistant?.id ?? null;
        restoreMessages(restored);
        const restoredFps = p.fps || DEFAULT_FPS;
        const restoredFormat: VideoFormat = isVideoFormat(p.format) ? p.format : DEFAULT_FORMAT;
        const restoredSeconds = clampSeconds((p.durationInFrames || DEFAULT_SECONDS * restoredFps) / restoredFps);
        setFps(restoredFps);
        setFormat(restoredFormat);
        setSeconds(restoredSeconds);
        setMusic(parseMusic(p.music));
        setVolume(typeof p.volume === "number" ? p.volume : DEFAULT_VOLUME);
        setLastGenSettings({ format: restoredFormat, seconds: restoredSeconds });
        if (p.model && MODELS.some((m) => m.id === p.model)) setModel(p.model);
        setCode(p.code);
        compileCode(p.code);
        markAsAiGenerated();
        setHasGeneratedOnce(true);
        setCurrentProject(projectParam, true);
      } catch (e) {
        if (!cancelled) {
          setGenerationError({ message: e instanceof Error ? e.message : String(e), type: "api" });
        }
      } finally {
        if (!cancelled) setLoadingProject(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectParam]);

  // Lancement automatique de la génération (demande venant de l'accueil ou de l'URL)
  useEffect(() => {
    if (initialPrompt && !hasAutoStarted && chatSidebarRef.current) {
      setHasAutoStarted(true);
      let images = pending?.images?.length ? pending.images : undefined;
      if (!images) {
        // compatibilité : images passées par l'ancien formulaire
        try {
          const stored = sessionStorage.getItem("initialAttachedImages");
          if (stored) images = JSON.parse(stored);
          sessionStorage.removeItem("initialAttachedImages");
        } catch {
          // ignoré
        }
      }
      setTimeout(() => chatSidebarRef.current?.triggerGeneration({ attachedImages: images }), 100);
    }
  }, [initialPrompt, hasAutoStarted, pending]);

  // Format ou durée changés depuis la dernière génération
  let needsAdapt: string | null = null;
  if (lastGenSettings && code) {
    const parts: string[] = [];
    if (lastGenSettings.format !== format) parts.push(`le format (${FORMATS[format].label})`);
    if (lastGenSettings.seconds !== seconds) parts.push(`la durée (${seconds} s)`);
    if (parts.length) needsAdapt = `Tu as changé ${parts.join(" et ")}.`;
  }

  const adaptWithClaude = () => {
    if (!lastGenSettings) return;
    const f = FORMATS[format];
    const asks: string[] = [];
    if (lastGenSettings.format !== format) {
      asks.push(
        `Adapte toute la mise en page au format ${f.label} (${f.width}×${f.height}) : rien ne doit déborder ni être coupé, garde le même contenu et le même style.`,
      );
    }
    if (lastGenSettings.seconds !== seconds) {
      asks.push(
        `La vidéo dure maintenant ${seconds} secondes (${durationInFrames} images à ${fps} i/s) : répartis les scènes sur cette durée, avec l'appel à l'action visible pendant les 2 dernières secondes.`,
      );
    }
    setPrompt(asks.join(" "));
    setTimeout(() => chatSidebarRef.current?.triggerGeneration(), 50);
  };

  const projectCost = messages.reduce((sum, m) => sum + (m.metadata?.cost ?? 0), 0);
  const generations = messages.filter((m) => m.role === "assistant").length;
  const busy = isStreaming || loadingProject;

  if (!initialPrompt && !projectParam) {
    return (
      <PageLayout>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-muted-foreground">Aucune vidéo en cours.</p>
          <Link href="/" className="text-primary hover:underline">
            Créer une nouvelle vidéo
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto p-4 md:px-6 min-[1100px]:flex-row min-[1100px]:overflow-hidden">
        <ChatSidebar
          ref={chatSidebarRef}
          messages={messages}
          pendingMessage={pendingMessage}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          hasManualEdits={hasManualEdits}
          onCodeGenerated={handleCodeChange}
          onStreamingChange={handleStreamingChange}
          onStreamPhaseChange={setStreamPhase}
          onError={handleError}
          prompt={prompt}
          onPromptChange={setPrompt}
          currentCode={code}
          conversationHistory={getFullContext()}
          previouslyUsedSkills={getPreviouslyUsedSkills()}
          isFollowUp={!isFirstGeneration}
          onMessageSent={handleMessageSent}
          onGenerationComplete={handleGenerationComplete}
          onErrorMessage={addErrorMessage}
          errorCorrection={errorCorrection ?? undefined}
          onPendingMessage={setPendingMessage}
          onClearPendingMessage={clearPendingMessage}
          Component={Component}
          fps={fps}
          durationInFrames={durationInFrames}
          currentFrame={currentFrame}
          model={model}
          format={format}
        />

        <div className="flex min-h-[70vh] min-w-0 flex-1 flex-col min-[1100px]:min-h-0">
          <TabPanel
            codeContent={
              <CodeEditor
                code={hasGeneratedOnce && !generationError ? code : ""}
                onChange={handleCodeChange}
                isStreaming={isStreaming}
                streamPhase={streamPhase}
              />
            }
            previewContent={
              loadingProject ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <AnimationPlayer
                  Component={generationError ? null : Component}
                  durationInFrames={durationInFrames}
                  fps={fps}
                  format={format}
                  musicSrc={currentMusicSrc}
                  volume={volume}
                  isCompiling={isCompiling}
                  isStreaming={isStreaming}
                  error={generationError?.message || codeError}
                  errorType={generationError?.type || "compilation"}
                  code={code}
                  onRuntimeError={handleRuntimeError}
                  onFrameChange={setCurrentFrame}
                />
              )
            }
          />
        </div>

        <VideoSettingsPanel
          format={format}
          onFormatChange={setFormat}
          seconds={seconds}
          onSecondsChange={setSeconds}
          music={music}
          onMusicChange={setMusic}
          volume={volume}
          onVolumeChange={setVolume}
          model={model}
          onModelChange={setModel}
          needsAdapt={needsAdapt}
          onAdapt={adaptWithClaude}
          busy={busy}
          projectCost={projectCost}
          generations={generations}
        />
      </div>
    </PageLayout>
  );
}

function LoadingFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

const GeneratePage: NextPage = () => (
  <Suspense fallback={<LoadingFallback />}>
    {/* l'espace (et donc l'identité BRAND) doit être connu avant de compiler le moindre code */}
    <SpaceProvider>
      <GeneratePageContent />
    </SpaceProvider>
  </Suspense>
);

export default GeneratePage;
