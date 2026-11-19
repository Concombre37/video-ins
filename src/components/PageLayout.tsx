"use client";

import { BalanceBar } from "./BalanceBar";
import { Header } from "./Header";

interface PageLayoutProps {
  children: React.ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="h-screen w-screen flex flex-col">
      <header className="flex items-center py-4 px-6 md:px-10 shrink-0 border-b border-border-dim">
        <Header />
      </header>
      {children}
      <BalanceBar />
    </div>
  );
}
