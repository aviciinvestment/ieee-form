import Image from "next/image";

export function AppLogo({ size = 96 }: { size?: number }) {
  return (
    <Image
      src="/logo.svg"
      alt="IEEE Logo"
      width={size}
      height={size}
      priority
      className="mx-auto"
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}