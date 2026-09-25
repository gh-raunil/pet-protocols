// Web Audio API Synthesized Chimes for Kitchen Alerts

export const CHIME_OPTIONS = [
  { id: "bell", label: "Classic Kitchen Bell 🔔", desc: "Crisp dual-tone kitchen order bell" },
  { id: "urgent", label: "High Priority Alert 🚨", desc: "Loud double-strike energetic kitchen chime" },
  { id: "pulse", label: "Modern Digital Pulse ⚡", desc: "Three-tone ascending electronic chime" },
  { id: "marimba", label: "Warm Acoustic Marimba 🪵", desc: "Rich resonant wooden chime" },
  { id: "gentle", label: "Gentle Harmonized Chime ✨", desc: "Soft ambient kitchen chime" },
];

export function getSavedChime() {
  if (typeof window === "undefined") return "bell";
  return localStorage.getItem("pet_protocols_chime_sound") || "bell";
}

export function setSavedChime(id) {
  if (typeof window !== "undefined") {
    localStorage.setItem("pet_protocols_chime_sound", id);
  }
}

export function playChime(chimeId = null, volume = 0.9) {
  if (typeof window === "undefined") return;

  const id = chimeId || getSavedChime();

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);
    masterGain.connect(ctx.destination);

    switch (id) {
      case "urgent": {
        // High-energy double chime (two quick loud bursts)
        [0, 0.22].forEach((offset) => {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const noteGain = ctx.createGain();

          osc1.type = "sine";
          osc1.frequency.setValueAtTime(987.77, now + offset); // B5
          osc1.frequency.exponentialRampToValueAtTime(1318.51, now + offset + 0.15); // E6

          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(1318.51, now + offset);

          noteGain.gain.setValueAtTime(0.8, now + offset);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.2);

          osc1.connect(noteGain);
          osc2.connect(noteGain);
          noteGain.connect(masterGain);

          osc1.start(now + offset);
          osc2.start(now + offset);
          osc1.stop(now + offset + 0.22);
          osc2.stop(now + offset + 0.22);
        });
        break;
      }

      case "pulse": {
        // 3 ascending digital pulses: E5, G#5, B5
        const notes = [659.25, 830.61, 987.77];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          const start = now + idx * 0.1;

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, start);

          noteGain.gain.setValueAtTime(0.7, start);
          noteGain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

          osc.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(start);
          osc.stop(start + 0.22);
        });
        break;
      }

      case "marimba": {
        // Warm marimba chord (warm harmonics)
        const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          const start = now + idx * 0.08;

          osc.type = "sine";
          osc.frequency.setValueAtTime(f, start);

          noteGain.gain.setValueAtTime(0.7, start);
          noteGain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

          osc.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(start);
          osc.stop(start + 0.38);
        });
        break;
      }

      case "gentle": {
        // Gentle harmonized bell (C5 -> G5)
        const notes = [523.25, 783.99];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          const start = now + idx * 0.14;

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, start);

          noteGain.gain.setValueAtTime(0.5, start);
          noteGain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);

          osc.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(start);
          osc.stop(start + 0.65);
        });
        break;
      }

      case "bell":
      default: {
        // Classic loud two-tone kitchen order bell (G5 -> C6)
        const bells = [
          { freq: 783.99, start: now, dur: 0.35 },
          { freq: 1046.5, start: now + 0.16, dur: 0.6 },
        ];

        bells.forEach(({ freq, start, dur }) => {
          const osc = ctx.createOscillator();
          const oscHarmonic = ctx.createOscillator();
          const noteGain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, start);

          oscHarmonic.type = "triangle";
          oscHarmonic.frequency.setValueAtTime(freq * 2, start);

          noteGain.gain.setValueAtTime(0.7, start);
          noteGain.gain.exponentialRampToValueAtTime(0.001, start + dur);

          osc.connect(noteGain);
          oscHarmonic.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(start);
          oscHarmonic.start(start);
          osc.stop(start + dur + 0.05);
          oscHarmonic.stop(start + dur + 0.05);
        });
        break;
      }
    }
  } catch (err) {
    console.warn("Audio chime playback blocked or unavailable:", err);
  }
}
