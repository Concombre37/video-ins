/* eslint-disable @next/next/no-img-element */
"use client";

import { cn } from "@/lib/utils";
import { History, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Nouvelle vidéo", icon: Plus },
  { href: "/history", label: "Historique", icon: History },
];

export function Header() {
  const pathname = usePathname();
  return (
    <div className="flex items-center justify-between w-full gap-6">
      <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
        <img src="/hytlabs-logo.png" alt="HytLabs" className="h-7 w-auto" />
        <span className="rounded-md bg-primary/15 border border-primary/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
          Studio
        </span>
      </Link>
      <nav className="flex items-center gap-1">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
              )}
            >
              <item.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
