/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Neon is reached over its WebSocket driver, which means `ws` runs on the server. It has to
  // stay outside the server bundle, otherwise its optional native helpers get bundled and
  // `ws` fails at runtime with "bufferUtil.mask is not a function".
  experimental: {
    // unpdf ships its own pdf.js build for Node, so it must not be bundled into the server chunks.
    serverComponentsExternalPackages: ["ws", "@neondatabase/serverless", "unpdf"],
  },
};

export default nextConfig;