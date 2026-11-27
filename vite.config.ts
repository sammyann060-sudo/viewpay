import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tanstackStart({ server: { entry: "server" } }), react(), tailwindcss(), nitro()],
  resolve: { tsconfigPaths: true },
  server: { host: true, port: 8080, strictPort: true },
});
