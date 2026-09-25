import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) resolves its worker script dynamically at
  // runtime — bundling it breaks that resolution under Turbopack/webpack.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
