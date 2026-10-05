# Touch Grass, Not Glass 🌿📷

**A camera that only works outside.** Open-weight AI loads a roll of field quests, the screen goes dark, and when you get home **Gemma develops your roll on your own machine**.

Built for the [DEV Hacktoberfest Open-Source AI Challenge, Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).

## How it works

1. **Load film (at home).** Gemma 3, running locally in [Ollama](https://ollama.com), writes six field quests for your month, time of day and destination ("Find a fallen maple leaf with vibrant red hues").
2. **Field mode (outside).** The screen turns near-black. One quest, read aloud. One shutter button. No previews, no feed, no checking. Shoot, and the next quest appears. No signal needed: the app shell is cached by a service worker and photos sit in IndexedDB.
3. **Darkroom (back home).** Hit *Develop roll*. Gemma's vision model looks at each photo, describes what it actually sees, decides whether you found it, and writes a specimen label and a two-line field note.
4. **Field journal.** Your developed roll, plus the only stat the app keeps: **% glass-free**, the share of your walk the screen was off.

## Run it

```bash
ollama pull gemma3:4b
npm start            # http://localhost:5173
```

Zero npm dependencies. Any Ollama vision model works; change it in *Settings* (`gemma3:12b`, `gemma3n`, `llava`, …).

**Phone in the field, PC at home:** open the app on your phone (HTTPS host such as GitHub Pages, or any LAN/HTTPS setup), shoot your roll, tap *Export roll*, then *Import roll* on the PC running Ollama and develop it there. Developing from the hosted page instead of `npm start`? Allow its origin in Ollama: `OLLAMA_ORIGINS=https://angelraph.github.io`. If no model is reachable when you load film, the app falls back to a built-in pocket deck of quests.

## Why open models

- **Offline by design:** field mode needs no network, and development needs no internet at all, only your machine.
- **Private:** photos and location never leave devices you own.
- **Free to run:** no API keys, no per-photo cost.
- **Yours to change:** swap models, edit the prompts in `ollama.js`, fine-tune for your local flora.

## Files

| file | what |
| --- | --- |
| `ollama.js` | quest writer + darkroom verifier (structured JSON output) |
| `app.js` | home, field mode, journal, glass-free timer |
| `store.js` | IndexedDB roll storage |
| `sw.js` | offline app shell |

MIT licensed.
