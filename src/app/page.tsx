"use client";

import {
  downloadBlob,
  encodeMp3FromWav,
  playComposition,
  renderCompositionAudio,
  stopComposition,
} from "@/lib/audio-client";
import { generateMidi } from "@/lib/midi";
import { scheduleComposition } from "@/lib/schedule";
import type { ChartLength, ComposeStyle, LookupResponse, SongSection } from "@/lib/types";
import {
  Download,
  Loader2,
  Music2,
  Pause,
  Piano,
  Play,
  Sparkles,
  Waves,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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

const CHART_LENGTH_OPTIONS: {
  id: ChartLength;
  label: string;
  description: string;
}[] = [
  {
    id: "short",
    label: "Short reference",
    description: "Main progressions only — best for Suno (~30 sec).",
  },
  {
    id: "full",
    label: "Full song",
    description: "Every chord in the chart — longer, complete run-through.",
  },
];

function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function sourceLabel(source: LookupResponse["source"]): string {
  switch (source) {
    case "hooktheory":
      return "Hooktheory TheoryTab";
    case "ultimate-guitar":
      return "Ultimate Guitar";
    case "manual":
      return "Pasted chart";
  }
}

export default function Home() {
  const [song, setSong] = useState("");
  const [artist, setArtist] = useState("");
  const [style, setStyle] = useState<ComposeStyle>("block");
  const [bpm, setBpm] = useState(120);
  const [beatsPerChord, setBeatsPerChord] = useState(4);
  const [loading, setLoading] = useState(false);
  const [renderingAudio, setRenderingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartLength, setChartLength] = useState<ChartLength>("short");
  const [composition, setComposition] = useState<LookupResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [wavBlob, setWavBlob] = useState<Blob | null>(null);
  const [mp3Loading, setMp3Loading] = useState(false);
  const [midiBytes, setMidiBytes] = useState<Uint8Array | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [manualChart, setManualChart] = useState("");
  const [showManualChart, setShowManualChart] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeSections = useMemo(() => {
    if (!composition) return [];
    if (chartLength === "full" && composition.sectionsFull?.length) {
      return composition.sectionsFull;
    }
    return composition.sections;
  }, [composition, chartLength]);

  const sections = activeSections;

  const totalChords = useMemo(
    () => sections.reduce((sum, section) => sum + section.chords.length, 0),
    [sections],
  );

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      void stopComposition();
    };
  }, [audioUrl]);

  async function rebuildAudio(
    data: LookupResponse,
    sectionsToRender: SongSection[],
    nextStyle: ComposeStyle,
    nextBpm: number,
    nextBeats: number,
  ) {
    setRenderingAudio(true);
    setError(null);

    try {
      const scheduled = scheduleComposition(sectionsToRender, {
        bpm: nextBpm,
        beatsPerChord: nextBeats,
        style: nextStyle,
      });

      const { wav, duration } = await renderCompositionAudio(scheduled);
      const midi = generateMidi(sectionsToRender, {
        bpm: nextBpm,
        beatsPerChord: nextBeats,
        style: nextStyle,
        trackName: `${data.title} - ${data.artist}`,
      });

      if (audioUrl) URL.revokeObjectURL(audioUrl);

      setWavBlob(wav);
      setMidiBytes(midi);
      setAudioDuration(duration);
      setAudioUrl(URL.createObjectURL(wav));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render audio preview.");
    } finally {
      setRenderingAudio(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setComposition(null);
    setAudioUrl(null);
    setWavBlob(null);
    setMidiBytes(null);
    setIsPlaying(false);
    await stopComposition();

    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          song,
          artist,
          bpm,
          beatsPerChord,
          chartLength,
          manualChart: manualChart.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as LookupResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to look up song.");
      }

      setComposition(payload);
      if (payload.bpm) setBpm(payload.bpm);
      setLoading(false);
      const initialSections =
        chartLength === "full" && payload.sectionsFull?.length
          ? payload.sectionsFull
          : payload.sections;
      await rebuildAudio(payload, initialSections as SongSection[], style, payload.bpm ?? bpm, beatsPerChord);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  async function handlePlayPreview() {
    if (!composition) return;

    if (isPlaying) {
      await stopComposition();
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    const scheduled = scheduleComposition(activeSections as SongSection[], {
      bpm,
      beatsPerChord,
      style,
    });

    await playComposition(scheduled);
    setIsPlaying(true);

    const durationMs = (audioDuration || 30) * 1000;
    window.setTimeout(() => setIsPlaying(false), durationMs);
  }

  function handleDownloadMidi() {
    if (!midiBytes || !composition) return;
    downloadBlob(new Blob([new Uint8Array(midiBytes)], { type: "audio/midi" }), `${sanitizeFilename(composition.title)}.mid`);
  }

  async function handleDownloadMp3() {
    if (!wavBlob || !composition) return;
    setMp3Loading(true);
    setError(null);
    try {
      const mp3 = await encodeMp3FromWav(wavBlob);
      downloadBlob(mp3, `${sanitizeFilename(composition.title)}.mp3`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to encode MP3.");
    } finally {
      setMp3Loading(false);
    }
  }

  function handleDownloadWav() {
    if (!wavBlob || !composition) return;
    downloadBlob(wavBlob, `${sanitizeFilename(composition.title)}.wav`);
  }

  const busy = loading || renderingAudio;

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
              <p className="text-sm text-[var(--muted)]">Song → chords → audio reference</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[var(--muted)] sm:flex">
            <Sparkles className="h-4 w-4 text-violet-300" />
            Suno-ready MP3 export
          </div>
        </header>

        <main className="grid flex-1 gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <section className="glass rounded-[2rem] p-8 shadow-2xl shadow-violet-950/40">
            <div className="mb-8">
              <h1 className="font-serif text-5xl leading-tight text-white sm:text-6xl">
                Chord reference tracks for Suno
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
                Look up any song&apos;s chords, preview the progression, then download an MP3
                to use as audio reference in Suno.
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
                        onClick={() => {
                          setStyle(option.id);
                          if (composition) {
                            void rebuildAudio(
                              composition,
                              activeSections as SongSection[],
                              option.id,
                              bpm,
                              beatsPerChord,
                            );
                          }
                        }}
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

              <div>
                <p className="mb-3 text-sm font-medium text-violet-100/90">Chart length</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CHART_LENGTH_OPTIONS.map((option) => {
                    const active = chartLength === option.id;
                    const disabled = option.id === "full" && !composition?.sectionsFull?.length && !!composition;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setChartLength(option.id);
                          if (composition) {
                            const sectionsToRender =
                              option.id === "full" && composition.sectionsFull?.length
                                ? composition.sectionsFull
                                : composition.sections;
                            void rebuildAudio(
                              composition,
                              sectionsToRender as SongSection[],
                              style,
                              bpm,
                              beatsPerChord,
                            );
                          }
                        }}
                        disabled={disabled}
                        className={`rounded-2xl border p-4 text-left transition ${
                          active
                            ? "border-violet-400/50 bg-violet-500/15 shadow-lg shadow-violet-900/20"
                            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                      >
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
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setBpm(next);
                      if (composition) {
                        void rebuildAudio(
                          composition,
                          activeSections as SongSection[],
                          style,
                          next,
                          beatsPerChord,
                        );
                      }
                    }}
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
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setBeatsPerChord(next);
                      if (composition) {
                        void rebuildAudio(
                          composition,
                          activeSections as SongSection[],
                          style,
                          bpm,
                          next,
                        );
                      }
                    }}
                    className="w-full"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <button
                  type="button"
                  onClick={() => setShowManualChart((open) => !open)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-sm font-medium text-violet-100/90">
                    Obscure song? Paste chords manually
                  </span>
                  <span className="text-sm text-[var(--muted)]">
                    {showManualChart ? "Hide" : "Show"}
                  </span>
                </button>
                {showManualChart ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-[var(--muted)]">
                      If Hooktheory and Ultimate Guitar both miss, paste a chord chart from anywhere.
                      Standard formats like Ultimate Guitar work best.
                    </p>
                    <textarea
                      value={manualChart}
                      onChange={(event) => setManualChart(event.target.value)}
                      placeholder={"Intro: ( Am7 D7 ) x4\nAm7 D7 Am7 D7\n..."}
                      rows={8}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm text-violet-50 outline-none transition focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                ) : null}
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-blue-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Looking up chords…
                  </>
                ) : renderingAudio ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Rendering audio preview…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Generate Preview
                  </>
                )}
              </button>
            </form>

            {composition && audioUrl ? (
              <div className="mt-8 rounded-[1.5rem] border border-violet-400/20 bg-violet-500/10 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300/80">
                      Audio preview
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Use the MP3 as Suno audio reference
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handlePlayPreview()}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isPlaying ? "Stop" : "Play preview"}
                  </button>
                </div>

                <audio
                  ref={audioRef}
                  controls
                  src={audioUrl}
                  className="mt-4 w-full"
                  onEnded={() => setIsPlaying(false)}
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleDownloadMp3()}
                    disabled={mp3Loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-60"
                  >
                    {mp3Loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {mp3Loading ? "Encoding MP3…" : "Download MP3"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadWav}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Download WAV
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadMidi}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Download MIDI
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="space-y-6">
            <div className="glass animate-float rounded-[2rem] p-8">
              <p className="text-sm uppercase tracking-[0.22em] text-violet-300/80">
                For Suno
              </p>
              <ol className="mt-5 space-y-4 text-[var(--muted)]">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm text-violet-200">
                    1
                  </span>
                  <span>Generate a chord reference track from any song.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm text-violet-200">
                    2
                  </span>
                  <span>Preview it in the browser before downloading.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm text-violet-200">
                    3
                  </span>
                  <span>Upload the MP3 to Suno as your audio reference.</span>
                </li>
              </ol>
            </div>

            {composition ? (
              <div className="glass rounded-[2rem] p-8">
                <p className="text-sm uppercase tracking-[0.22em] text-violet-300/80">
                  Composition
                </p>
                <h2 className="font-serif mt-3 text-3xl text-white">{composition.title}</h2>
                <p className="mt-1 text-[var(--muted)]">{composition.artist}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-violet-100">
                    Key: {composition.key}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-violet-100">
                    {totalChords} chords
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-violet-100">
                    Source: {sourceLabel(composition.source)}
                  </span>
                  {audioDuration > 0 ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-violet-100">
                      {Math.round(audioDuration)}s
                    </span>
                  ) : null}
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
                    ["Lay It On The Line", "Triumph"],
                    ["Creep", "Radiohead"],
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
                            key={`${section.name}-${chord.label}-${index}`}
                            className="chord-chip rounded-full px-3 py-1.5 text-sm text-violet-100"
                          >
                            {chord.label}
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
          Chord data from Hooktheory TheoryTab. MP3/WAV previews are synthesized drafts — perfect
          as Suno reference, not final production audio.
        </footer>
      </div>
    </div>
  );
}
