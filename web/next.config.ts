import path from "node:path";
import type { NextConfig } from "next";
import { parseEnv } from "./src/lib/parse-env";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    localPatterns: [{ pathname: "/images/**" }],
  },
  headers: () =>
    Promise.resolve([
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ]),
  rewrites: () => {
    const { BACKEND_URL } = parseEnv(process.env);
    return Promise.resolve([
      {
        source: "/images/:path*",
        destination: `${BACKEND_URL}/images/:path*`,
      },
    ]);
  },
};

export default nextConfig;
