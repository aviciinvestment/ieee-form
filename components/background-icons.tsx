"use client";

import { useEffect, useState } from "react";
import { Trophy, Target, Cpu, Code, GraduationCap, BookOpen } from "lucide-react";

export function BackgroundIcons() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const icons = [Trophy, Target, Cpu, Code, GraduationCap, BookOpen];
  
  // Generate a random set of icons that will fall
  const fallingIcons = Array.from({ length: 20 }).map((_, i) => {
    const Icon = icons[Math.floor(Math.random() * icons.length)];
    const left = `${Math.random() * 100}%`;
    const animationDelay = `${Math.random() * 15}s`;
    const animationDuration = `${10 + Math.random() * 15}s`;
    const size = 20 + Math.random() * 40;
    const opacity = 0.05 + Math.random() * 0.1;
    
    return (
      <Icon
        key={i}
        className="absolute animate-fall pointer-events-none text-primary dark:text-primary-foreground"
        style={{
          left,
          top: "-10%",
          animationDelay,
          animationDuration,
          width: size,
          height: size,
          opacity: opacity,
        }}
      />
    );
  });

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {fallingIcons}
    </div>
  );
}
