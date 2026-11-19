"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usd } from "@/lib/video-settings";
import type { ConversationMessage } from "@/types/conversation";
import { AlertTriangle, BookOpen, FileCode, PenLine, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

interface ChatHistoryProps {
  messages: ConversationMessage[];
  pendingMessage?: {
    skills?: string[];
    startedAt: number;
  };
}

const modelName = (m?: string) => (m?.includes("haiku") ? "Haiku" : m?.includes("sonnet") ? "Sonnet" : m);

export function ChatHistory({ messages, pendingMessage }: ChatHistoryProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingMessage]);

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
      {messages.length === 0 && !pendingMessage && (
        <p className="pt-2 text-xs leading-relaxed text-muted-foreground-dim">
          Demande des retouches ici : « plus rapide », « mets le prix plus gros », « change la scène 2 »…
          Le bouton appareil photo envoie l&apos;image en cours de l&apos;aperçu à Claude.
        </p>
      )}
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
      {pendingMessage && <PendingMessage skills={pendingMessage.skills} />}
      <div ref={endRef} />
    </div>
  );
}

function SkillsHint({ skills }: { skills: string[] }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex ml-1.5 align-middle cursor-help">
          <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={4}>
        Guides utilisés : {skills.join(", ")}
      </TooltipContent>
    </Tooltip>
  );
}

function ChatMessage({ message }: { message: ConversationMessage }) {
  const time = new Date(message.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const metadata = message.metadata;

  if (message.role === "user") {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Toi</span>
          <span className="text-xs text-muted-foreground-dim">{time}</span>
        </div>
        <div className="whitespace-pre-wrap rounded-lg bg-secondary/70 px-3 py-2 text-sm leading-relaxed text-foreground">
          {message.content}
          {message.attachedImages && message.attachedImages.length > 0 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {message.attachedImages.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={img} alt={`Image ${i + 1}`} className="h-16 w-auto shrink-0 rounded border border-border object-cover" />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (message.role === "error") {
    const label =
      message.errorType === "api"
        ? "Erreur de génération"
        : message.errorType === "validation"
          ? "Problème détecté"
          : "Modification non appliquée";
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="pl-6 text-xs leading-relaxed text-red-300/80 break-words">{message.content}</div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-primary">Claude</span>
        <span className="text-xs text-muted-foreground-dim">{time}</span>
        {(metadata?.model || metadata?.cost != null) && (
          <span className="ml-auto rounded bg-secondary/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {[modelName(metadata?.model), metadata?.cost != null ? usd(metadata.cost) : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </div>
      <div className="text-sm leading-relaxed text-foreground">
        {message.content}
        {metadata?.skills && metadata.skills.length > 0 && <SkillsHint skills={metadata.skills} />}
      </div>
      {metadata?.editType === "tool_edit" && metadata.edits && (
        <div className="mt-2 space-y-1.5 pl-1">
          {metadata.edits.map((edit, i) => (
            <div key={i} className="flex items-center gap-2">
              <PenLine className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{edit.description}</span>
            </div>
          ))}
        </div>
      )}
      {metadata?.editType === "full_replacement" && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileCode className="w-3.5 h-3.5" />
          <span className="text-xs">Code entièrement réécrit</span>
        </div>
      )}
    </div>
  );
}

function PendingMessage({ skills }: { skills?: string[] }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-primary">Claude</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="w-3 h-3 rounded-full border-2 border-muted-foreground border-t-primary animate-spin" />
        <span>Génération en cours…</span>
        {skills && skills.length > 0 && <SkillsHint skills={skills} />}
      </div>
    </div>
  );
}
