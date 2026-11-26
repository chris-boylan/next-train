import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates the PWA icons from public/icon.svg: `npx pwa-assets-generator` in packages/web. Output is committed.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#169b62' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#169b62' } },
  },
  images: ['public/icon.svg'],
});
