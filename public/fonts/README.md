# Self-Hosted Fonts (Electron Build)

For the Electron/Steam build, self-host these fonts instead of using Google Fonts CDN:

- **Cinzel** (Display): wght 400, 600, 700 — https://fonts.google.com/specimen/Cinzel
- **Source Sans 3** (Body): wght 400, 600, 700 — https://fonts.google.com/specimen/Source+Sans+3

## Steps
1. Download .woff2 files for each weight
2. Place in `public/fonts/`
3. Replace `<link>` in `index.html` with `@font-face` declarations
4. Update `src/App.css` `--font-*` fallbacks to local names
