"use client";

import { cn } from "@/lib/utils";
import { Code, Play } from "lucide-react";
import { useState } from "react";

export type TabId = "code" | "preview";

interface TabPanelProps {
  codeContent: React.ReactNode;
  previewContent: React.ReactNode;
  defaultTab?: TabId;
}

export function TabPanel({ codeContent, previewContent, defaultTab = "preview" }: TabPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  const tabs = [
    { id: "preview" as const, label: "Aperçu", icon: Play },
    { id: "code" as const, label: "Code", icon: Code },
  ];

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="inline-flex w-fit mb-4 shrink-0 rounded-lg border border-border bg-background-elevated p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
      {/* les deux onglets restent montés pour ne pas relancer l'aperçu à chaque bascule */}
      <div className={cn("flex-1 min-h-0", activeTab !== "code" && "hidden")}>{codeContent}</div>
      <div className={cn("flex-1 min-h-0", activeTab !== "preview" && "hidden")}>{previewContent}</div>
    </div>
  );
}
