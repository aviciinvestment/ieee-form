"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Home, LogOut, Menu } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  subtitle?: string;
  onLogout: () => void;
  children: React.ReactNode;
};

export function DashboardShell({ title, subtitle, onLogout, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <header className="fixed inset-x-0 top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-3 sm:px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="focus-ring"
            onClick={() => setMenuOpen((m) => !m)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="h-8 px-2.5 text-xs flex items-center gap-1.5 border-border/70 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        {menuOpen ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div className="absolute right-3 sm:right-4 z-50 mt-1 w-60 max-w-[calc(100vw-1.5rem)] rounded-md border bg-popover p-1.5 shadow-lg">
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
              >
                <Home className="h-4 w-4" /> Registration Form
              </Link>
              <Link
                href="/quiz"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
              >
                <ClipboardList className="h-4 w-4" /> My Track Quizzes
              </Link>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 rounded-sm px-3 py-2 text-red-600 hover:text-red-600 dark:text-red-400"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
              >
                <LogOut className="h-4 w-4" /> Logout
              </Button>
            </div>
          </>
        ) : null}
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col px-3 sm:px-4 pb-16 pt-14 min-w-0">
        <div className="py-6 sm:py-8 text-center min-w-0 px-1">
          <AppLogo size={70} />
          <h1 className="mt-4 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight break-words">{title}</h1>
          {subtitle ? <p className="mt-2 text-xs sm:text-sm text-muted-foreground break-words max-w-xl mx-auto">{subtitle}</p> : null}
        </div>
        <div className="w-full min-w-0">{children}</div>
      </main>
    </div>
  );
}