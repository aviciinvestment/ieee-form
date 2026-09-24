"use client";

import { useState } from "react";
import Link from "next/link";
import { Home, LogOut, Menu } from "lucide-react";
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
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="focus-ring"
            onClick={() => setMenuOpen((m) => !m)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-xs font-medium tracking-wide text-muted-foreground">IEEE Portal</span>
          <div className="w-10" />
        </div>
        {menuOpen ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div className="absolute right-4 z-50 mt-1 w-60 rounded-md border bg-popover p-1.5 shadow-lg">
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
              >
                <Home className="h-4 w-4" /> Registration Form
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

      <main className="mx-auto flex max-w-5xl flex-col px-4 pb-16 pt-14">
        <div className="py-8 text-center">
          <AppLogo size={80} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}