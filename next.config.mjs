/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Neon is reached over its WebSocket driver, which means `ws` runs on the server. It has to
  // stay outside the server bundle, otherwise its optional native helpers get bundled and
  // `ws` fails at runtime with "bufferUtil.mask is not a function".
  serverExternalPackages: ["ws", "@neondatabase/serverless", "@prisma/adapter-neon", "@prisma/client", "unpdf"],
  experimental: {
    // unpdf must not be bundled into the server chunks.
    serverComponentsExternalPackages: ["ws", "@neondatabase/serverless", "@prisma/adapter-neon", "@prisma/client", "unpdf"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;