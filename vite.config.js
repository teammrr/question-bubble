import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    // Two pages: the IG question sticker and the chat-bubble alt
    rolldownOptions: {
      input: { main: "index.html", chat: "chat.html" },
    },
  },
});
