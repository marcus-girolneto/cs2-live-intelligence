import path from "node:path";
import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@cs2/contracts"],
  poweredByHeader: false,
};
export default config;
