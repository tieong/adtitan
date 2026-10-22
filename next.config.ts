import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "iovalkey", "@clickhouse/client", "@hyperframes/producer", "puppeteer", "puppeteer-core"],
  // pg loads pg-cloudflare through a "workerd" export condition that file tracing misses.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/.pnpm/pg-cloudflare@*/node_modules/pg-cloudflare/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
