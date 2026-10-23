import path from "node:path";
import type { NextConfig } from "next";
import { parseEnv } from "./src/lib/parse-env";

const nextConfig: NextConfig = {
  output: "standalone",
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
