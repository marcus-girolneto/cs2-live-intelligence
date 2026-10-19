import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.next-e2e/**",
      "**/.next-build/**",
      "**/node_modules/**",
      "**/next-env.d.ts",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  ...tseslint.configs.recommended,
  { rules: { "@typescript-eslint/no-explicit-any": "error" } },
);
