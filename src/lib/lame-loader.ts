"use client";

interface LamejsGlobal {
  Mp3Encoder: new (
    channels: number,
    sampleRate: number,
    kbps: number,
  ) => {
    encodeBuffer: (left: Int16Array, right?: Int16Array) => Int8Array;
    flush: () => Int8Array;
  };
}

declare global {
  interface Window {
    lamejs?: LamejsGlobal;
  }
}

let lameLoadPromise: Promise<LamejsGlobal> | null = null;

export function loadLamejs(): Promise<LamejsGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MP3 encoding is only available in the browser."));
  }

  if (window.lamejs?.Mp3Encoder) {
    return Promise.resolve(window.lamejs);
  }

  if (!lameLoadPromise) {
    lameLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-lamejs="true"]');
      if (existing) {
        existing.addEventListener("load", () => {
          if (window.lamejs?.Mp3Encoder) resolve(window.lamejs);
          else reject(new Error("lamejs failed to initialize."));
        });
        existing.addEventListener("error", () => reject(new Error("Failed to load MP3 encoder.")));
        return;
      }

      const script = document.createElement("script");
      script.src = "/lame.min.js";
      script.async = true;
      script.dataset.lamejs = "true";
      script.onload = () => {
        if (window.lamejs?.Mp3Encoder) resolve(window.lamejs);
        else reject(new Error("lamejs failed to initialize."));
      };
      script.onerror = () => reject(new Error("Failed to load MP3 encoder."));
      document.head.appendChild(script);
    });
  }

  return lameLoadPromise;
}
