"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="fixed bottom-[18px] right-[18px] z-[60] h-[46px] w-[46px] rounded-full border border-border bg-card/80" />
    );
  }

  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="outline"
      size="icon"
      className="focus-ring fixed bottom-[18px] right-[18px] z-[60] h-[46px] w-[46px] rounded-full bg-card/80 shadow-md"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}