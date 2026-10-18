import Image from "next/image";

export function AppLogo({ size = 44 }: { size?: number }) {
  const badge = Math.round(size * 1.15);
  const ieeeWidth = Math.round(size * 1.8);
  const ieeeHeight = Math.round(size * 1.0);
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6 mx-auto max-w-full px-2">
      <Image
        src="/download.png"
        alt="NAU Logo"
        width={badge}
        height={badge}
        priority
        className="shrink-0 max-w-[38%] drop-shadow-md dark:drop-shadow-[0_0_12px_rgba(255,255,255,0.8)] transition-all object-contain"
        style={{ width: "auto", height: badge, maxHeight: badge }}
      />
      <Image
        src="/logo.svg"
        alt="IEEE Logo"
        width={ieeeWidth}
        height={ieeeHeight}
        priority
        className="shrink-0 max-w-[55%] drop-shadow-md dark:drop-shadow-[0_0_12px_rgba(255,255,255,0.8)] transition-all object-contain"
        style={{ width: "auto", height: ieeeHeight, maxHeight: ieeeHeight }}
      />
    </div>
  );
}