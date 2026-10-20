import tseslint from "typescript-eslint";

// apps/web layering (docs/ADR-005-web-architecture.md):
//   app → composition → features → shared;  server is used only by app route handlers.
const WEB = "apps/web";
const deepFeature = {
  group: ["@/features/*/*", "@/features/*/**"],
  message:
    "Import another feature only through its public index: '@/features/<name>'.",
};
const legacy = {
  regex: "^(\\.\\./){2,}(lib|components)/",
  message: "apps/web/lib and apps/web/components were removed; use src/.",
};
const noFetch = {
  selector: "CallExpression[callee.name='fetch']",
  message:
    "Network calls belong in src/shared/http (HttpClient) or src/server (route handlers).",
};

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
  {
    files: [`${WEB}/**/*.{ts,tsx}`],
    ignores: [`${WEB}/src/shared/http/**`, `${WEB}/src/server/**`],
    rules: { "no-restricted-syntax": ["error", noFetch] },
  },
  {
    files: [`${WEB}/src/shared/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "@/composition/*", "@/server/*"],
              message:
                "shared/ must not depend on features, composition or server.",
            },
            {
              regex: "\\.\\./(\\.\\./)*(features|composition|server)/",
              message:
                "shared/ must not depend on features, composition or server.",
            },
            legacy,
          ],
        },
      ],
    },
  },
  {
    files: [`${WEB}/src/features/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            deepFeature,
            {
              group: ["@/composition/*", "@/server/*", "next/headers"],
              message:
                "Features are client/UI code: no composition, server or next/headers imports.",
            },
            {
              regex: "^\\.\\./\\.\\./\\.\\./",
              message:
                "Stay inside the feature; import other features through '@/features/<name>' and shared code through '@/shared/*'.",
            },
            legacy,
          ],
        },
      ],
    },
  },
  {
    files: [`${WEB}/app/**/*.{ts,tsx}`, `${WEB}/src/composition/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": ["error", { patterns: [deepFeature, legacy] }],
    },
  },
  {
    // Per-language bundles are the one place that reaches into features' i18n folders.
    files: [`${WEB}/src/composition/locales/**/*.ts`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@/features/[^/]+/(?!i18n/[a-z]{2}$).+",
              message: deepFeature.message,
            },
            legacy,
          ],
        },
      ],
    },
  },
  {
    files: [`${WEB}/src/server/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "@/composition/*", "react", "react-dom"],
              message: "src/server is route-handler code: no UI imports.",
            },
            legacy,
          ],
        },
      ],
    },
  },
);
