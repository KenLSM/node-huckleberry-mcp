import { defineConfig } from "vitest/config";

export default defineConfig({
  // Source files use explicit ".js" import specifiers (NodeNext style). Map them
  // back to the ".ts" sources so Vitest can resolve them.
  resolve: {
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1" }],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
