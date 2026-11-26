import path from "node:path";
import type { NextConfig } from "next";

// Cloudflare Pages tells the build which branch it is building.
// staging -> staging.statspuck.com, anything else -> statspuck.com.
const branch = process.env.CF_PAGES_BRANCH ?? "";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (branch && branch !== "main" ? "https://staging.statspuck.com" : "https://statspuck.com");

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_SITE_URL: siteUrl },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
