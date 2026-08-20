# Chord Composer

Turn any song into a MIDI draft. Enter a song title and artist — the app looks up the chord progression from Hooktheory TheoryTab and generates a downloadable `.mid` file.

## Features

- Instant song lookup by title + artist (~75k songs)
- Section-by-section chord preview
- Three MIDI styles: block chords, arpeggio, bass + harmony
- Adjustable tempo and beats per chord
- Ready to deploy on Vercel

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push this repo to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Deploy — no environment variables required

Or use the Vercel CLI:

```bash
npx vercel
```

## How it works

1. Search Hooktheory's TheoryTab database for the song
2. Parse chord progressions per section (verse, chorus, etc.)
3. Convert chords to MIDI notes and write a `.mid` file

Chord data is sourced from [Hooktheory TheoryTab](https://www.hooktheory.com/theorytab/). Generated MIDI files are draft approximations — import into your DAW and refine from there.
