import Image from "next/image";

export function AppLogo({ size = 44 }: { size?: number }) {
  const badge = Math.round(size * 1.15);
  return (
    <div className="flex items-center justify-center gap-6 mx-auto">
      <Image
        src="/download.png"
        alt="NAU Logo"
        width={badge}
        height={badge}
        priority
        className="shrink-0 drop-shadow-md dark:drop-shadow-[0_0_12px_rgba(255,255,255,0.8)] transition-all"
        style={{ width: badge, height: badge, objectFit: "contain" }}
      />
      <Image
        src="/logo.svg"
        alt="IEEE Logo"
        width={Math.round(size * 1.8)}
        height={Math.round(size * 1.0)}
        priority
        className="shrink-0 drop-shadow-md dark:drop-shadow-[0_0_12px_rgba(255,255,255,0.8)] transition-all"
        style={{ width: Math.round(size * 1.8), height: Math.round(size * 1.0), objectFit: "contain" }}
      />
    </div>
  );
}