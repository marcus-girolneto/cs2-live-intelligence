import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dir = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  resolve: {
    alias: {
      "@/features": dir("./src/features"),
      "@/shared": dir("./src/shared"),
      "@/server": dir("./src/server"),
      "@/composition": dir("./src/composition"),
    },
  },
  // Hook/component tests opt into a DOM with `// @vitest-environment happy-dom`.
  esbuild: { jsx: "automatic" },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
});
