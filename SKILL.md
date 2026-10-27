---
name: vibe-design-studio
version: 1.1.0
category: creative
description: "Headless creative & motion design studio for AI agents (Remotion, React 18, Whisper, EBU R128). Produces high-end reels from scripts or raw recordings (silence cutting, word-level Hormozi captions, -14 LUFS audio mastering), 4:5 editorial carousels as PNGs, and kinetic motion graphics with physical spring easing curves. Refuses to call a result done until visually and audibly measured. Trigger with /vibe, /video, /reel, /carrossel, /motion, 'criar video', 'gerar reel', 'legendar video', 'fazer carrossel', or 'motion design'."
tags: [vibe-design-studio, remotion, ai-video, motion-graphics, video-generation, reels, tiktok, youtube-shorts, carousels, captions, hormozi-captions, whisper, ebu-r128, silence-cutting, react-video, vibe-coding, creative, claude-code, codex, antigravity]
---

# Vibe Design Studio, for agents

The studio is a **taste prosthesis**: good taste lives in the code (style packs, scene recipes, quality gates), not in
the model that calls it. You do not design from scratch. You **choose from closed catalogs and fill in text and
numbers**; the studio does layout, timing, colors, audio and checks. A small model and a large model get the same floor.

## Rules (never break)

1. Do not write TSX or timeline JSON by hand. Do not invent component names, style names, files or props: ask the
   studio (`pnpm vibe componentes`, `pnpm vibe estilos`, `pnpm vibe motion modelos`).
2. Never say it is done from reading code. Done = `pnpm vibe verificar` approved **and** you opened the contact sheet
   (the `folha` PNG every command writes) and it looks right: text legible, nothing cropped, scenes differ.
3. A rejected spec is not an obstacle: the error message says what to change. Change the spec, not the studio.
4. Reply to the user in their language. Keep the briefing short: format, who it is for, the text.

## Step 0: environment (once)

`pnpm install`, then `pnpm vibe doctor`. Fix everything it shows in red before producing (it says what to install).
`pnpm vibe pastas` creates the local media folders (media never goes to Git).

## Quick path: which command?

| The user wants | Command |
|---|---|
| A reel/TikTok/Short **from a script** (the studio makes the voice) | `pnpm vibe roteiro "script text" --vertical --voz thalita --estilo escuro-tech` |
| A reel from **their own recording** (cuts silence, captions, -14 LUFS) | `pnpm vibe reel-gravacao take.mp4 --roteiro "what they said"` |
| A **static carousel** (PNG for the feed, 4:5) | `pnpm vibe carrossel spec.json --estilo-visual editorial-creme` |
| **Motion graphics without narration** (title, brand card, numbers) | `pnpm vibe motion exemplo <modelo> > spec.json`, edit texts, `pnpm vibe motion spec.json` |
| Only **cut the silence** of a recording | `pnpm vibe cortar-silencio in.mp4 out.mp4` (add `--simular` to preview) |
| **Check** any finished video | `pnpm vibe verificar out/videos/x.mp4 --formato 9:16 --folha out/folha` (add `--sem-audio` for motion) |
| See styles, components, models | `pnpm vibe estilos`, `pnpm vibe componentes`, `pnpm vibe motion modelos` |

Run `pnpm vibe ajuda` for the list. Every command writes under `out/` and prints the result and the contact sheet path.

### Reel from a script
- Style: pick one id from `pnpm vibe estilos` (dark tech, cream editorial, luxury titanium, ...). It sets colors, captions and mood for the whole video.
- Scenes: by default each sentence becomes one scene and the visual follows its content (a number becomes a counter, a question a hook, the last call to action a CTA card; neighbors never repeat). To direct a scene yourself, pass `--cenas plan.json` (see `src/timeline/scenePlan.ts`).
- Audio is mastered to -14 LUFS in two passes; do not touch levels.

### Reel from the user's recording
`--roteiro` is the exact text spoken: captions use YOUR text and Whisper only gives the timing, so words are never mis-transcribed.
Without Whisper installed, `--roteiro` is required and the timing is estimated.

### Carousel (ask the user first, never assume)
Ask: **how many slides** (2 to 10), **uniform style or each slide directed**, and **static feed images or slides to animate later**.
Then write `spec.json`: `nome`, `estilo` (`uniforme|individual`), `destino` (`estatico|animado`), `autor`, `marca`, `slides[]`
(`categoria`, `titulo` 1 to 3 lines of at most 24 characters, `destaque` as its own accent line after the title, `subtitulo`,
`palco.destaque` up to 14 characters). Full rules are in the header of `scripts/carrossel.mjs`. Static slides are not
monotone by luck: vary the titles and the stage phrases, one idea per slide.

### Motion graphics
Three closed models: `titulo-cinetico` (1 to 4 phrases), `cartao-de-marca` (brand, slogan, badge), `dataviz` (numbers that count and a real series
curve). Copy the example, edit only the texts and numbers, run it. Fixed values (colors, timing) are not yours to change.

## Taste loop (before delivering)

Open the contact sheet and answer honestly: Is every text readable on its background? Is anything cut by the screen edge?
Do the scenes look different from each other? Is there any text the user did not write (demo text)? If something is off,
change the **spec or the style id** and run again. If the studio cannot express what the user asked, say so plainly
instead of faking it.

## Creative models (Opus-class): the escape hatch

Closed catalogs are a floor, not a ceiling. If, and only if, the idea cannot be expressed with the commands above, you may
compose a new scene with the components listed by `pnpm vibe componentes` in a timeline file and render it with
`node scripts/render_from_json.mjs timeline.json out/x.mp4 --master`. The result still has to pass `pnpm vibe verificar`, and you must tell the user that you left the closed path.

## Limits you must tell the user about

- Remotion needs a company license above 3 employees (see README).
- Local media (music, voices, client photos) is never versioned; keep names ASCII and the project path short (Windows limit).
- Whisper and the TTS voice need to be installed/online; `pnpm vibe doctor` shows what is missing.
