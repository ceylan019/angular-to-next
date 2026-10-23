import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import globals from "globals";

export default defineConfig(
  { ignores: ["playwright-report", "test-results"] },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='waitForTimeout']",
          message: "Wait with a web first assertion, never a fixed timeout.",
        },
      ],
    },
  },
  {
    files: ["tests/**/*.ts", "support/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='waitForTimeout']",
          message: "Wait with a web first assertion, never a fixed timeout.",
        },
        {
          selector: "CallExpression[callee.name='setTimeout']",
          message: "Wait with a web first assertion, never a timer.",
        },
        {
          selector: "MemberExpression[property.name='setTimeout']",
          message: "Wait with a web first assertion, never a timer.",
        },
      ],
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@playwright/test",
              allowTypeImports: true,
              message:
                "Import test and expect from support/fixtures so every test starts from a reset backend.",
            },
          ],
        },
      ],
    },
  },
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: { allowDefaultProject: ["*.mjs"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
