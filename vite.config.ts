import vue from "@vitejs/plugin-vue"
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

export default defineConfig(({ mode }) => {
  if (mode === "example") {
    return {
      root: fileURLToPath(new URL("./examples", import.meta.url)),
      plugins: [vue()],
      server: {
        host: "127.0.0.1",
        port: 5174
      }
    }
  }
  return {
    plugins: [vue(), dts({
      tsconfigPath: "./tsconfig.json",
      include: ["src"],
      entryRoot: "src"
    })],
    build: {
      lib: {
        entry: "src/index.ts",
        formats: ["es"],
        fileName: "emtionji"
      },
      rollupOptions: {
        external: ["vue", "motion"],
        output: {
          globals: { vue: "Vue", motion: "Motion" }
        }
      }
    }
  }
})
