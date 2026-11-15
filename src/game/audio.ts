/**
 * Procedural Web Audio API Sound Engine for Pelagic Vanguard.
 * Zero external audio file dependencies.
 */

class AbyssalAudioEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    try {
      const savedMute = localStorage.getItem('pelagic_vanguard_muted');
      if (savedMute === 'true') {
        this.muted = true;
      }
    } catch {
      // Ignore storage access errors
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.noiseBuffer) {
      const sampleRate = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, sampleRate * 1.0, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    try {
      localStorage.setItem('pelagic_vanguard_muted', String(mute));
    } catch {
      // Ignore
    }
  }

  public setVolumes(
    master: number,
    _music: number,
    sfx: number,
    _ui: number,
    muted: boolean,
  ): void {
    this.muted = muted || master <= 0 || sfx <= 0;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.playSonarPing(660);
    }
    return this.muted;
  }

  public playLaserShot(overcharged: boolean = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = overcharged ? 'sawtooth' : 'triangle';
    const startFreq = overcharged ? 980 : 820;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.095);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playSonarPing(pitch: number = 780): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.18, now + 0.09);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playTorpedoLaunch(count: number = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Low sub-impulse + filtered cavitation noise whoosh
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(520 + count * 40, now + 0.26);

    oscGain.gain.setValueAtTime(0.14, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.29);

    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(500, now);
      filter.frequency.exponentialRampToValueAtTime(1600, now + 0.25);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.12, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.27);
    }
  }

  public playBarrelRoll(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.16);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.34);

    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playThrusterIgnite(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Turbine spool-up whine (220Hz -> 1320Hz -> 680Hz)
    const turbineOsc = ctx.createOscillator();
    const turbineGain = ctx.createGain();
    turbineOsc.type = 'sawtooth';
    turbineOsc.frequency.setValueAtTime(220, now);
    turbineOsc.frequency.exponentialRampToValueAtTime(1320, now + 0.45);
    turbineOsc.frequency.exponentialRampToValueAtTime(980, now + 1.9);
    turbineOsc.frequency.exponentialRampToValueAtTime(310, now + 2.65);

    const turbineFilter = ctx.createBiquadFilter();
    turbineFilter.type = 'bandpass';
    turbineFilter.frequency.setValueAtTime(900, now);
    turbineFilter.Q.setValueAtTime(3.5, now);

    turbineGain.gain.setValueAtTime(0.001, now);
    turbineGain.gain.linearRampToValueAtTime(0.055, now + 0.28);
    turbineGain.gain.setValueAtTime(0.04, now + 1.8);
    turbineGain.gain.exponentialRampToValueAtTime(0.0008, now + 2.7);

    turbineOsc.connect(turbineFilter);
    turbineFilter.connect(turbineGain);
    turbineGain.connect(ctx.destination);
    turbineOsc.start(now);
    turbineOsc.stop(now + 2.72);

    // 2. Deep sub-bass combustion thump & rumble
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(115, now);
    subOsc.frequency.exponentialRampToValueAtTime(54, now + 0.18);
    subOsc.frequency.linearRampToValueAtTime(68, now + 1.6);
    subOsc.frequency.exponentialRampToValueAtTime(36, now + 2.65);

    subGain.gain.setValueAtTime(0.24, now);
    subGain.gain.setValueAtTime(0.18, now + 1.75);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.68);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 2.7);

    // 3. Turbulent jet afterburner roar (filtered white noise)
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(380, now);
      filter.frequency.exponentialRampToValueAtTime(1850, now + 0.25);
      filter.frequency.setValueAtTime(1450, now + 1.85);
      filter.frequency.exponentialRampToValueAtTime(260, now + 2.68);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.01, now);
      nGain.gain.linearRampToValueAtTime(0.24, now + 0.14);
      nGain.gain.setValueAtTime(0.2, now + 1.85);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 2.7);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 2.72);
    }
  }

  public playImpact(heavy: boolean = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = heavy ? 0.42 : 0.18;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = heavy ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(heavy ? 130 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + duration);

    gain.gain.setValueAtTime(heavy ? 0.26 : 0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);

    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(heavy ? 900 : 1200, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + duration);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(heavy ? 0.22 : 0.1, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + duration + 0.02);
    }
  }

  public playBossTelegraph(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(420, now + 0.35);
    osc.frequency.linearRampToValueAtTime(280, now + 0.65);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  public playStageClearFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    });
  }

  public playPickupChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.07);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playAppendageBreak(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Resonant structural snap (dual detuned sawtooth sweep)
    [320, 480].forEach((startFreq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(startFreq, now + i * 0.04);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.48);

      gain.gain.setValueAtTime(0.2, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + 0.52);
    });

    // 2. High-frequency crystalline/chitin shatter burst
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 0.45);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.24, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.48);
    }
  }

  public playTacticalSonarPulse(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Primary bathypelagic acoustic ping + harmonic echo return
    const pings = [
      { delay: 0, freqStart: 520, freqEnd: 1040, dur: 0.38, vol: 0.16 },
      { delay: 0.22, freqStart: 1040, freqEnd: 1380, dur: 0.45, vol: 0.11 },
    ];

    pings.forEach(({ delay, freqStart, freqEnd, dur, vol }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqStart, now + delay);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, now + delay + dur);

      gain.gain.setValueAtTime(vol, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.02);
    });
  }

  public playPressureGroan(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.exponentialRampToValueAtTime(54, now + 0.34);

    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(64, now);
    subOsc.frequency.exponentialRampToValueAtTime(38, now + 0.34);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.exponentialRampToValueAtTime(110, now + 0.34);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 0.37);
    subOsc.stop(now + 0.37);
  }
}

export const soundEngine = new AbyssalAudioEngine();
