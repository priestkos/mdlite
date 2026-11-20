import { defineConfig } from 'vite';

// Electron loads the built document through file://, not a web server root.
export default defineConfig({ base: './' });
