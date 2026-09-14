import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Il dev server ascolta su 0.0.0.0 cosi' l'app e' raggiungibile
// anche dal telefono sulla stessa rete Wi-Fi.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 5173,
  },
});
