import { toast } from "../ui/notify.js";

/**
 * Original synthesised sound effects (Web Audio API) – no audio files, nothing copied.
 * Every sound has a caption so it is accessible without audio.
 */

const SOUNDS = {
  terminal: { caption: "[terminal activates]", notes: [[660, 0.05], [880, 0.08]], wave: "square" },
  correct: { caption: "[correct – access granted]", notes: [[523, 0.08], [784, 0.14]], wave: "triangle" },
  incorrect: { caption: "[incorrect – access denied]", notes: [[220, 0.12], [165, 0.18]], wave: "sawtooth" },
  objective: { caption: "[objective complete]", notes: [[523, 0.07], [659, 0.07], [784, 0.07], [1047, 0.16]], wave: "triangle" },
  levelUp: { caption: "[rank up]", notes: [[392, 0.1], [523, 0.1], [659, 0.1], [784, 0.25]], wave: "square" },
  boss: { caption: "[warning: boss round]", notes: [[440, 0.25], [330, 0.25], [440, 0.25], [330, 0.25]], wave: "sawtooth" },
  streak: { caption: "[streak bonus]", notes: [[880, 0.06], [1175, 0.1]], wave: "triangle" },
  shoot: { caption: null, notes: [[900, 0.07]], slide: 0.25, wave: "square", volume: 0.18, noise: 0.05 },
  hit: { caption: null, notes: [[1400, 0.04]], wave: "triangle", volume: 0.35 },
  explode: { caption: "[drone destroyed]", notes: [[180, 0.25]], slide: 0.2, wave: "sawtooth", volume: 0.4, noise: 0.35 },
  pickup: { caption: "[shield orb collected]", notes: [[660, 0.05], [990, 0.05], [1320, 0.1]], wave: "sine", volume: 0.45 },
  reload: { caption: null, notes: [[260, 0.04], [0, 0.12], [420, 0.05]], wave: "square", volume: 0.2 },
  empty: { caption: null, notes: [[140, 0.04]], wave: "square", volume: 0.2 },
  damage: { caption: "[shield hit]", notes: [[140, 0.14]], slide: 0.5, wave: "sawtooth", volume: 0.4, noise: 0.08 },
  alarm: { caption: "[alarm – extra drone deployed]", notes: [[700, 0.15], [500, 0.15]], wave: "square" },
  door: { caption: "[door unlocks]", notes: [[300, 0.06], [450, 0.12]], wave: "triangle" },
};

export class SoundBoard {
  /** @param {() => { masterVolume: number, captions: boolean }} getSettings */
  constructor(getSettings) {
    this.getSettings = getSettings;
    this.context = null;
    this.noiseBuffer = null;
    this.lastCaptionAt = 0;
  }

  #noise(context) {
    if (!this.noiseBuffer) {
      const length = Math.floor(context.sampleRate * 0.5);
      this.noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer;
  }

  #context() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return null;
      this.context = new AudioContextClass();
    }
    if (this.context.state === "suspended") this.context.resume();
    return this.context;
  }

  play(name) {
    const sound = SOUNDS[name];
    if (!sound) return;
    const settings = this.getSettings();
    if (settings.captions && sound.caption && performance.now() - this.lastCaptionAt > 400) {
      this.lastCaptionAt = performance.now();
      toast(sound.caption, "caption", 1800);
    }
    const volume = settings.masterVolume * (sound.volume ?? 0.5);
    if (volume <= 0) return;
    try {
      const context = this.#context();
      if (!context) return;
      let start = context.currentTime;
      if (sound.noise) {
        // Filtered white noise gives shots and explosions some body.
        const source = context.createBufferSource();
        source.buffer = this.#noise(context);
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(3000, start);
        filter.frequency.exponentialRampToValueAtTime(200, start + sound.noise);
        const gain = context.createGain();
        gain.gain.setValueAtTime(volume * 0.5, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + sound.noise);
        source.connect(filter).connect(gain).connect(context.destination);
        source.start(start);
        source.stop(start + sound.noise);
      }
      for (const [frequency, duration] of sound.notes) {
        if (frequency > 0) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = sound.wave;
          oscillator.frequency.setValueAtTime(frequency, start);
          if (sound.slide) oscillator.frequency.exponentialRampToValueAtTime(frequency * sound.slide, start + duration);
          gain.gain.setValueAtTime(volume * 0.2, start);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
          oscillator.connect(gain).connect(context.destination);
          oscillator.start(start);
          oscillator.stop(start + duration);
        }
        start += duration;
      }
    } catch {
      // Audio is optional; captions still show.
    }
  }
}
