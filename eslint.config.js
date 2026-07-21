import js from "@eslint/js"
import { defineConfig, globalIgnores } from "eslint/config"
import vue from "eslint-plugin-vue"
import globals from "globals"
import tseslint from "typescript-eslint"
import vueParser from "vue-eslint-parser"

export default defineConfig([
  globalIgnores(["dist", "node_modules"]),
  {
    files: ["**/*.{ts,vue}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      ...vue.configs["flat/recommended"]
    ],
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.browser,
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
        sourceType: "module"
      }
    },
    rules: {
      "vue/html-self-closing": "off",
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off"
    }
  }
])
