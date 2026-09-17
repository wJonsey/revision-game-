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
  shoot: { caption: null, notes: [[1200, 0.03], [600, 0.03]], wave: "square", volume: 0.25 },
  hit: { caption: null, notes: [[300, 0.05]], wave: "square", volume: 0.3 },
  damage: { caption: "[shield hit]", notes: [[110, 0.1]], wave: "sawtooth", volume: 0.4 },
  alarm: { caption: "[alarm – extra drone deployed]", notes: [[700, 0.15], [500, 0.15]], wave: "square" },
  door: { caption: "[door unlocks]", notes: [[300, 0.06], [450, 0.12]], wave: "triangle" },
};

export class SoundBoard {
  /** @param {() => { masterVolume: number, captions: boolean }} getSettings */
  constructor(getSettings) {
    this.getSettings = getSettings;
    this.context = null;
    this.lastCaptionAt = 0;
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
      for (const [frequency, duration] of sound.notes) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = sound.wave;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(volume * 0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + duration);
        start += duration;
      }
    } catch {
      // Audio is optional; captions still show.
    }
  }
}
