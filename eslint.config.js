import js from "@eslint/js";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "**/build/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/.tmp/**",
      "**/public/**",
    ],
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    ...js.configs.recommended,
    ...prettier,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
      },
    },
    rules: {
      "no-console": "warn",
      "no-unused-vars": "warn",
    },
  },
  {
    files: ["backend/**/*.js"],
    languageOptions: {
      globals: {
        strapi: "readonly",
      },
    },
    rules: {
      "no-console": "off", // Allow console in backend
      "no-unused-vars": "warn",
      "no-case-declarations": "off",
    },
  },
  {
    files: ["**/*.json"],
    rules: {
      // Disable all rules for JSON files
    },
  },
];
