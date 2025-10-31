# Bloons TD 6 Tier Lab

An interactive tier list builder for Bloons TD 6 heroes, towers, and paragons. Drag-and-drop units into S–D tiers, or fall back to quick reassignment prompts when drag isn't available. Progress is stored locally so you can revisit and refine your rankings.

## Features

- Preloaded roster of towers, heroes, and paragons from `src/data.json`
- Drag-and-drop tier assignment powered by [`dnd-kit`](https://github.com/clauderic/dnd-kit)
- Click-to-assign fallback using browser `prompt()` dialogs
- Persistent layout via `localStorage`
- Quick reset and JSON export of the current tier layout

## Getting Started

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` to start arranging your tier list. Use the **Reset** button to clear the board or **Export JSON** to copy/share your current configuration.

## Building for Production

```bash
npm run build
```

The production-ready assets will be emitted to the `dist/` directory.
