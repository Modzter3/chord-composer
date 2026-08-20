"use client";

import * as Tone from "tone";
import { midiToNoteName } from "./chords";
import { getCompositionDuration, type ScheduledNote } from "./schedule";

function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * channels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length, true);

  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[sampleIndex]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

async function wavToMp3(wavBlob: Blob): Promise<Blob> {
  const { Mp3Encoder } = await import("lamejs");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const view = new DataView(buffer);
        const samples = new Int16Array(buffer, 44);

        const sampleRate = view.getUint32(24, true);
        const encoder = new Mp3Encoder(1, sampleRate, 128);
        const mp3Chunks: Int8Array[] = [];
        const blockSize = 1152;

        for (let index = 0; index < samples.length; index += blockSize) {
          const chunk = samples.subarray(index, index + blockSize);
          const encoded = encoder.encodeBuffer(chunk);
          if (encoded.length > 0) mp3Chunks.push(encoded);
        }

        const flushed = encoder.flush();
        if (flushed.length > 0) mp3Chunks.push(flushed);

        const totalLength = mp3Chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const merged = new Uint8Array(totalLength);
        let writeOffset = 0;
        for (const chunk of mp3Chunks) {
          merged.set(chunk, writeOffset);
          writeOffset += chunk.length;
        }

        resolve(new Blob([merged], { type: "audio/mpeg" }));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(wavBlob);
  });
}

async function renderAudioBuffer(notes: ScheduledNote[]): Promise<AudioBuffer> {
  const duration = getCompositionDuration(notes);

  const rendered = await Tone.Offline(() => {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.03, decay: 0.2, sustain: 0.35, release: 0.6 },
    }).toDestination();
    synth.volume.value = -8;

    for (const note of notes) {
      synth.triggerAttackRelease(
        midiToNoteName(note.midi),
        note.duration,
        note.time,
        note.velocity,
      );
    }
  }, duration);

  return rendered.get() as unknown as AudioBuffer;
}

export async function renderCompositionAudio(
  notes: ScheduledNote[],
): Promise<{ wav: Blob; mp3: Blob; duration: number }> {
  const audioBuffer = await renderAudioBuffer(notes);
  const wav = encodeWav(audioBuffer);
  const mp3 = await wavToMp3(wav);
  return { wav, mp3, duration: audioBuffer.duration };
}

let activeSynth: Tone.PolySynth<Tone.Synth> | null = null;

export async function playComposition(notes: ScheduledNote[]): Promise<void> {
  await Tone.start();
  await stopComposition();

  activeSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.03, decay: 0.2, sustain: 0.35, release: 0.6 },
  }).toDestination();
  activeSynth.volume.value = -8;

  for (const note of notes) {
    activeSynth.triggerAttackRelease(
      midiToNoteName(note.midi),
      note.duration,
      Tone.now() + note.time,
      note.velocity,
    );
  }
}

export async function stopComposition(): Promise<void> {
  if (activeSynth) {
    activeSynth.releaseAll();
    activeSynth.dispose();
    activeSynth = null;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
