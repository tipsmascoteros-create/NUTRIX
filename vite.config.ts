import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
      // Inline the small compiled stylesheet into dist/index.html to avoid a
      // render-blocking CSS roundtrip on initial FCP/LCP.
      {
        name: 'inline-critical-css',
        apply: 'build',
        enforce: 'post',
        transformIndexHtml(html, ctx) {
          if (!ctx.bundle) return html;
          let updatedHtml = html;
          for (const [fileName, chunk] of Object.entries(ctx.bundle)) {
            if (fileName.endsWith('.css') && chunk.type === 'asset' && typeof chunk.source === 'string') {
              const escapedFile = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const linkRegex = new RegExp(
                `<link[^>]+rel="stylesheet"[^>]+href="/?${escapedFile}"[^>]*>`,
                'g',
              );
              if (linkRegex.test(updatedHtml)) {
                updatedHtml = updatedHtml.replace(
                  linkRegex,
                  () => `<style>${chunk.source as string}</style>`,
                );
              }
            }
          }
          return updatedHtml;
        },
      },
    ],
    build: {
      target: 'es2022',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
