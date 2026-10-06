# Touch Grass, Not Glass

A camera that only works outside.

You get six small things to find. The screen goes dark while you look for them. When you get home, an open model running on your own computer develops your photos into a little field journal.

Try it at https://touch-grass-not-glass.vercel.app or read the docs at https://touch-grass-not-glass.vercel.app/docs.html

I built this for the [DEV Hacktoberfest 2026 Open-Source AI Challenge](https://dev.to/challenges/hacktoberfest-week1-2026-10-05), week 1, Touch Grass.

## How it works

At home you load the film. You pick where you're going, and Gemma 3 (running locally through [Ollama](https://ollama.com)) writes six quests that fit the month, the time of day and the place.

Outside, the screen goes nearly black. You see one quest at a time, it gets read out loud, and there's a single "I found it" button. No preview and no feed. It works with no signal at all.

Back home you develop the roll. Gemma looks at each photo, writes down what it actually sees, then decides whether you found what you were looking for. Each frame gets a title and a short field note.

The app only keeps one number: how long the screen was off during your walk.

## Running it

You need Ollama and the Gemma 3 model:

```bash
ollama pull gemma3:4b
npm start
```

Then open http://localhost:5173. There are no npm dependencies, and you don't need a graphics card. On a laptop CPU it takes about two minutes to develop each photo, so it's a good moment to make tea.

The docs explain how to walk with your phone and develop on your computer, how to pick a different model, and what to do if something doesn't connect.

## Why an open model

The whole thing depends on it. The walking part has to work where there's no signal, the photos shouldn't end up on someone else's server, it should cost nothing to run, and I wanted to be able to swap the model or change the prompts whenever I like. All of that is easy when the model runs on your own machine.

## Where things are

The landing page is index.html and the docs are docs.html. The camera is app.html and app.js. The two Gemma prompts are in ollama.js. Rolls are saved in the browser by store.js, and sw.js is the service worker that keeps the app working offline. Styles, fonts and the sample roll are in the assets folder.

## Credits

The sample photos come from Wikimedia Commons under Creative Commons licences, by Wilfredor, Dietmar Rabich, Malene Thyssen, Holger Krisp, Charles J. Sharp and Ermell (details in assets/samples/CREDITS.txt). The fonts are Fraunces and Inter, both under the SIL Open Font License. The code is MIT licensed.
