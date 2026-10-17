# Beatwarp: music warps your image

Beatwarp is a music visualizer for your own pictures. Upload any photo (or video, or use your camera), play music, and the picture tunnels, melts, shatters and breathes to the beat. Then record the result as a clip.

Everything runs locally in WebGL2 and Web Audio. Nothing is uploaded.

## Run it

It's a static site with no build step and no dependencies:

```bash
python3 -m http.server 8000      # or: npx serve .
# open http://localhost:8000
```

ES modules don't load over `file://`, so you need a local server.

## Deploy

It's a static site, so GitHub Pages serving the repo root (Settings → Pages → Deploy from a branch → `main` / `/ (root)`) works as is. Netlify, Vercel or any other static host works too.

Live: https://sankshitpandoh.github.io/beatwarp/

## What it does

- **Picture:** upload or drop an image or a video, paste one from the clipboard, or use the live camera. A 5-colour palette is pulled from your image with k-means.
- **Music:** a built-in demo beat, any audio file, or the microphone. The analyser splits the sound into sub, bass, mids and highs and detects kicks with spectral flux. Every mode responds to all of them.
- **20 modes:** none, smear (liquid feedback), droste, infinite (tunnel), corridor, cube, planet, windows, melt, shatter, prism, terrain (a flyover of a landscape grown from your picture), breathe, mosh, sort, scanline, thresh, solar, halftone and vhs. A kick changes the structure in each mode: the tunnel pulses, the shards explode, the tracking slams, and so on.
- **Space controls:** symmetry (bilateral, quad, radial up to 12), spin, tiles, twist, slice, chaos, and a lens with 7 styles: glass ribs, glass fan, anamorphic, melt, glitch, pixels, fly eye.
- **Light controls:** trails (feedback), heat (bloom and kick flashes), brightness, vignette, hue drift. **Response controls:** react, decay, input gain.
- **Palettes:** the Photo palette plus 11 presets. The picture keeps its own colours. The palette only colours the world around it, such as kick accents, frames and the terrain sky.
- **Looks:** 16 presets and a 🎲 randomiser.
- **Output:** pick an aspect ratio (Fill, 9:16 Reel, 1:1, 4:5, 16:9), record a clip with the audio included (MP4 where the browser supports it, otherwise WebM), save a PNG, or go fullscreen.

Keys: `Space` play/pause · `←/→` change mode · `R` random · `H` hide panel · `F` fullscreen.

## Code map

| File | Purpose |
|---|---|
| `js/shaders.js` | GLSL. The effect pass handles space transforms, the 20 modes and trails. The post pass handles bloom, accents and vignette. |
| `js/renderer.js` | WebGL2 setup, ping-pong feedback buffers, image and video textures |
| `js/audio.js` | Audio sources, band analysis, kick detection |
| `js/demo.js` | Synthesised demo loop (kick, clap, hats, bass, pad, arp) |
| `js/palette.js` | Palette presets, k-means extraction, hue rotation |
| `js/config.js` | Modes, parameter definitions, presets |
| `js/recorder.js` | Canvas and audio capture with MediaRecorder |
| `js/main.js` | UI wiring and the frame loop |
