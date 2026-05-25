/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    css: true,
    reporters: ["verbose"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/__tests__/",
        "**/styles.ts",
        "*.config.js",
        "*.config.ts",
        "**/App-styles.ts",
        "**/commonStyles.ts",	
        "**/GenAiTypes.ts",
        "**/ThemeV2.tsx",
        "**/main.tsx",
        "**/constants.ts",
        "**/types.ts",
        "**/dist/**",
        "**/ui/dist/**",
        "dist/**",
        "src/screens/ConversationalBot/index.js",
      ],
    },
  },
});
