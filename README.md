# Touch Grass, Not Glass 🌿

**The camera that only works outside.** You get six small things to find. The screen goes dark. You go and look. When you're home, an open-weight AI on your own computer **develops your roll** into a field journal.

**Live:** https://touch-grass-not-glass.vercel.app · **Docs:** https://touch-grass-not-glass.vercel.app/docs.html

Built for the [DEV Hacktoberfest 2026 Open-Source AI Challenge, Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).

## How it works

| Stage | Where | What happens |
| --- | --- | --- |
| **Load the film** | at home | Gemma 3 (local, via [Ollama](https://ollama.com)) writes six field quests for the month, time of day and destination. |
| **Field mode** | outside | The screen goes near-black. You see one quest, read aloud, and an *I found it* button. No preview, no feed. Works offline. |
| **Develop** | back home | Gemma's vision model describes what each photo actually shows, *then* decides whether you found it, and writes a specimen title and field note. |

The only metric is **glass-free %**: the share of your walk the screen was off.

## Quick start

```bash
ollama pull gemma3:4b
npm start            # http://localhost:5173
```

Zero npm dependencies. No GPU needed (about 2 minutes per photo on a laptop CPU). The full setup, the phone-plus-computer workflow, model choices and troubleshooting are in the [docs](https://touch-grass-not-glass.vercel.app/docs.html).

## Why open models

- **Offline by design:** field mode needs no network, and the darkroom only needs your own machine.
- **Private:** photos never leave devices you own. No accounts, no analytics, no server.
- **Free to run:** no API keys, no per-photo cost.
- **Yours to change:** swap models in Settings, edit the prompts in `ollama.js`, fine-tune for your local flora.

## Files

| file | what |
| --- | --- |
| `index.html`, `docs.html` | landing page (with FAQ) and documentation |
| `app.html`, `app.js` | the camera: Today, field mode, journal, settings |
| `ollama.js` | quest writer + darkroom verifier (structured JSON output) |
| `store.js` | IndexedDB roll storage |
| `sw.js` | offline app shell |
| `assets/` | styles, self-hosted fonts (OFL), sample roll |

## Credits

Sample photos (CC BY / BY-SA, Wikimedia Commons) by Wilfredor, Dietmar Rabich, Malene Thyssen, Holger Krisp, Charles J. Sharp and Ermell; see `assets/samples/CREDITS.txt`. Fonts: Fraunces and Inter (SIL OFL). Code: MIT.
