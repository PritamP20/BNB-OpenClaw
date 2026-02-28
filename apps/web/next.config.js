import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone output is only needed for Docker — skip it during local dev
  // because it copies all traced node_modules into .next/standalone, wasting GBs.
  ...(isProd && { output: "standalone" }),
  // In Next.js 16 this moved to the top level (out of experimental).
  // Only needed for standalone Docker builds so file tracing covers the monorepo.
  ...(isProd && { outputFileTracingRoot: path.join(__dirname, "../../") }),
  // Offload gzip to a reverse-proxy / CDN; saves CPU per request.
  compress: false,
  // Remove the X-Powered-By header (tiny overhead reduction).
  poweredByHeader: false,
  // Next.js 16 uses Turbopack by default for both dev and build.
  // An empty turbopack object silences the "webpack config present" warning.
  turbopack: {},
  // Proxy /api/* → internal Express API on port 4000.
  // This means NEXT_PUBLIC_API_URL can be set to "/api" so browser calls
  // go to the Next.js server (same host/port), which forwards to localhost:4000.
  // Avoids hardcoding the public hostname in the JS bundle.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:4000/:path*",
      },
    ];
  },
};

export default nextConfig;
