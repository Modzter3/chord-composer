"use client";

import {
  Download,
  Loader2,
  Music2,
  Piano,
  Sparkles,
  Waves,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { ComposeStyle } from "@/lib/types";

interface SectionPreview {
  name: string;
  chords: string[];
}

const STYLE_OPTIONS: {
  id: ComposeStyle;
  label: string;
  description: string;
  icon: typeof Piano;
}[] = [
  {
    id: "block",
    label: "Block Chords",
    description: "Full chords held together — great for pads and piano.",
    icon: Piano,
  },
  {
    id: "arpeggio",
    label: "Arpeggio",
    description: "Notes played in sequence — lighter, more rhythmic.",
    icon: Waves,
  },
  {
    id: "bass",
    label: "Bass + Harmony",
    description: "Root in the left hand, triads on top.",
    icon: Music2,
  },
];

export default function Home() {
  const [song, setSong] = useState("");
  const [artist, setArtist] = useState("");
  const [style, setStyle] = useState<ComposeStyle>("block");
  const [bpm, setBpm] = useState(120);
  const [beatsPerChord, setBeatsPerChord] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<SectionPreview[]>([]);
  const [meta, setMeta] = useState<{ title: string; artist: string; key: string } | null>(
    null,
  );

  const totalChords = useMemo(
    () => sections.reduce((sum, section) => sum + section.chords.length, 0),
    [sections],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSections([]);
    setMeta(null);

    try {
      const response = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song, artist, style, bpm, beatsPerChord }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to compose MIDI.");
      }

      const title = response.headers.get("X-Song-Title") ?? song;
      const foundArtist = response.headers.get("X-Song-Artist") ?? artist;
      const key = response.headers.get("X-Song-Key") ?? "";
      const sectionsHeader = response.headers.get("X-Song-Sections");

      if (sectionsHeader) {
        setSections(JSON.parse(sectionsHeader) as SectionPreview[]);
      }

      setMeta({ title, artist: foundArtist, key });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.mid`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-pulse-glow absolute -left-24 top-0 h-96 w-96 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="animate-pulse-glow absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-blue-600/20 blur-3xl [animation-delay:1.5s]" />
        <div className="absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 lg:px-10">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/20 ring-1 ring-violet-400/30">
              <Music2 className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-violet-300/80">
                Chord Composer
              </p>
              <p className="text-sm text-[var(--muted)]">Song → chords → MIDI</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[var(--muted)] sm:flex">
            <Sparkles className="h-4 w-4 text-violet-300" />
            Powered by TheoryTab data
          </div>
        </header>

        <main className="grid flex-1 gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <section className="glass rounded-[2rem] p-8 shadow-2xl shadow-violet-950/40">
            <div className="mb-8">
              <h1 className="font-serif text-5xl leading-tight text-white sm:text-6xl">
                Turn any song into a MIDI draft
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
                Enter a song and artist. We look up the chord progression instantly and
                generate a downloadable MIDI you can drop into your DAW.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-violet-100/90">Song title</span>
                  <input
                    required
                    value={song}
                    onChange={(event) => setSong(event.target.value)}
                    placeholder="Someone Like You"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white outline-none transition focus:border-violet-400/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet-500/20"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-violet-100/90">Artist</span>
                  <input
                    required
                    value={artist}
                    onChange={(event) => setArtist(event.target.value)}
                    placeholder="Adele"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white outline-none transition focus:border-violet-400/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet-500/20"
                  />
                </label>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-violet-100/90">Arrangement style</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {STYLE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = style === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setStyle(option.id)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          active
                            ? "border-violet-400/50 bg-violet-500/15 shadow-lg shadow-violet-900/20"
                            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                        }`}
                      >
                        <Icon
                          className={`mb-3 h-5 w-5 ${active ? "text-violet-300" : "text-[var(--muted)]"}`}
                        />
                        <p className="font-medium text-white">{option.label}</p>
                        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-violet-100/90">Tempo</span>
                    <span className="rounded-full bg-violet-500/15 px-3 py-1 text-sm text-violet-200">
                      {bpm} BPM
                    </span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={180}
                    value={bpm}
                    onChange={(event) => setBpm(Number(event.target.value))}
                    className="w-full"
                  />
                </label>
                <label className="block space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-violet-100/90">Beats per chord</span>
                    <span className="rounded-full bg-violet-500/15 px-3 py-1 text-sm text-violet-200">
                      {beatsPerChord}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    value={beatsPerChord}
                    onChange={(event) => setBeatsPerChord(Number(event.target.value))}
                    className="w-full"
                  />
                </label>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-blue-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Looking up chords…
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    Compose & Download MIDI
                  </>
                )}
              </button>
            </form>
          </section>

          <aside className="space-y-6">
            <div className="glass animate-float rounded-[2rem] p-8">
              <p className="text-sm uppercase tracking-[0.22em] text-violet-300/80">
                How it works
              </p>
              <ol className="mt-5 space-y-4 text-[var(--muted)]">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm text-violet-200">
                    1
                  </span>
                  <span>Search 75,000+ analyzed songs by title and artist.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm text-violet-200">
                    2
                  </span>
                  <span>Pull the chord progression section by section.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm text-violet-200">
                    3
                  </span>
                  <span>Generate a MIDI draft and download it instantly.</span>
                </li>
              </ol>
            </div>

            {meta ? (
              <div className="glass rounded-[2rem] p-8">
                <p className="text-sm uppercase tracking-[0.22em] text-violet-300/80">
                  Last composition
                </p>
                <h2 className="font-serif mt-3 text-3xl text-white">{meta.title}</h2>
                <p className="mt-1 text-[var(--muted)]">{meta.artist}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-violet-100">
                    Key: {meta.key}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-violet-100">
                    {totalChords} chords
                  </span>
                </div>
              </div>
            ) : (
              <div className="glass rounded-[2rem] p-8">
                <p className="text-sm uppercase tracking-[0.22em] text-violet-300/80">
                  Try these
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    ["Someone Like You", "Adele"],
                    ["Creep", "Radiohead"],
                    ["Bad Guy", "Billie Eilish"],
                  ].map(([exampleSong, exampleArtist]) => (
                    <button
                      key={exampleSong}
                      type="button"
                      onClick={() => {
                        setSong(exampleSong);
                        setArtist(exampleArtist);
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-violet-400/30 hover:bg-violet-500/10"
                    >
                      <span>
                        <span className="block font-medium text-white">{exampleSong}</span>
                        <span className="text-sm text-[var(--muted)]">{exampleArtist}</span>
                      </span>
                      <Sparkles className="h-4 w-4 text-violet-300" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sections.length > 0 ? (
              <div className="glass rounded-[2rem] p-8">
                <p className="text-sm uppercase tracking-[0.22em] text-violet-300/80">
                  Chord preview
                </p>
                <div className="mt-5 space-y-5">
                  {sections.map((section) => (
                    <div key={section.name}>
                      <p className="mb-2 text-sm font-medium text-violet-200/90">{section.name}</p>
                      <div className="flex flex-wrap gap-2">
                        {section.chords.map((chord, index) => (
                          <span
                            key={`${section.name}-${chord}-${index}`}
                            className="chord-chip rounded-full px-3 py-1.5 text-sm text-violet-100"
                          >
                            {chord}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </main>

        <footer className="mt-10 text-center text-sm text-[var(--muted)]">
          Chord data sourced from Hooktheory TheoryTab. MIDI drafts are approximations — import
          into your DAW and tweak from there.
        </footer>
      </div>
    </div>
  );
}
