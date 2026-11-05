import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Product images are plain <img> tags (no Vercel image optimisation quota used).
};

export default nextConfig;
