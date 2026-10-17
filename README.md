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
- **20 modes:** Original, Liquid, Spiral, Tunnel, Corridor, Cube, Planet, Screens, Melt, Shatter, Prism, Terrain (a flyover of a landscape grown from your picture), Breathe, Glitch, Streak, Scanline, Poster, Invert, Halftone and VHS. A kick changes the structure in each mode: the tunnel pulses, the shards explode, the tracking slams, and so on. On a phone, swipe sideways on the picture to change mode.
- **Feel:** beat response, wobble, trails, glow and speed, up front. **Fine tune:** symmetry (bilateral, quad, radial up to 12), spin, tiles, twist, slices, and a lens with 7 styles (glass ribs, glass fan, anamorphic, melt, glitch, pixels, fly eye); brightness, vignette, colour cycle and effect mix; settle time and sensitivity.
- **Palettes:** the Photo palette plus 11 presets. The picture keeps its own colours. The palette only colours the world around it, such as kick accents, frames and the terrain sky.
- **Looks:** 16 presets, Mutate (randomise everything) and Undo.
- **Output:** record a clip with the audio included (MP4 where the browser supports it, otherwise WebM), then share or save it from the preview. Phones record 9:16 by default; other aspects are Fill, 1:1, 4:5 and 16:9. Save a PNG or go fullscreen.
- **Comfort:** a Reduce flashing switch (on by default with reduced motion), and single-key shortcuts can be turned off.

Keys: `Space` play/pause · `←/→` change mode · `1`–`0` modes 1–10 (`Shift` for 11–20) · `[ ]` palette · `R` mutate · `Z` undo · `C` record · `H` controls · `F` fullscreen · `?` all shortcuts.

## Design

The interface is "wetware": a living organism wired into a night-city machine. The picture is the specimen and gets all the colour; the UI is dark glass grown around it, with chartreuse and teal as the living colours and magenta as a rare signal. Organic, slowly morphing shapes mark what is on, HUD notches mark containers, and only small elements pulse with the beat. Type is Syne (display), Chakra Petch (UI) and Martian Mono (readouts).

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
