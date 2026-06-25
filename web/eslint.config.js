import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "wasm-pkg", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Empty catch blocks are intentional (try/catch for optional localStorage/WASM ops)
      "no-empty": ["error", { allowEmptyCatch: true }],
      // These new react-hooks v7 rules are too strict for our ref-based WASM object pattern
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  }
);
