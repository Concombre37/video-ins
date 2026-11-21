/* eslint-disable @next/next/no-img-element */
"use client";

import { cn } from "@/lib/utils";
import { isSpaceId } from "@/lib/spaces";
import { History, Images, LogOut, MessageSquareText, Plus, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSpace } from "./SpaceProvider";

export function Header() {
  const pathname = usePathname();
  const { me, switchSpace } = useSpace();
  const space = me.spaces.find((s) => s.id === me.space) ?? me.spaces[0];
  const nav = [
    { href: "/", label: "Nouvelle vidéo", icon: Plus },
    { href: "/media", label: "Médiathèque", icon: Images },
    { href: "/history", label: "Projets", icon: History },
    { href: "/requests", label: "Retouches", icon: MessageSquareText },
    ...(me.user.admin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];
  return (
    <div className="flex items-center justify-between w-full gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity shrink-0">
          <img src={space.logo} alt={space.name} className="h-7 w-auto" />
          <span className="rounded-md bg-primary/15 border border-primary/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            Studio
          </span>
        </Link>
        {me.spaces.length > 1 && (
          <select
            value={me.space}
            onChange={(e) => isSpaceId(e.target.value) && switchSpace(e.target.value)}
            className="rounded-lg border border-border bg-background-elevated px-2 py-1 text-xs text-foreground"
            title="Changer d'espace"
            aria-label="Espace"
          >
            {me.spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <nav className="flex items-center gap-1">
        {nav.map((item) => {
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
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
        <a
          href="/api/auth/logout"
          className="ml-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          title={`Connecté : ${me.user.name} (${me.user.email}) — se déconnecter`}
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden xl:inline max-w-[140px] truncate">{me.user.name}</span>
        </a>
      </nav>
    </div>
  );
}
