import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env (see .env.example) before starting the server."
    );
  }

  // Neon blocks direct TCP on 5432 from this network, so the driver connects through the
  // WebSocket proxy on port 443. Unlike the HTTP driver this one supports nested writes and
  // interactive transactions, which the quiz create/update flows rely on.
  //
  // Node 22 exposes a global WebSocket that the driver uses on its own. On older runtimes we
  // hand it the `ws` package instead; that package is kept out of the server bundle in
  // next.config.mjs because its optional native helpers break when they are bundled.
  if (typeof WebSocket === "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    neonConfig.webSocketConstructor = require("ws");
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;