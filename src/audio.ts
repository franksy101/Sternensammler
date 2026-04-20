import { CONFIG } from "./config";

/**
 * All sound is synthesized against a single AudioContext that is lazily
 * created on the first user gesture (mobile autoplay policy). The ambient
 * pad and optional rain are long-lived singletons; chimes are short
 * one-shot oscillators.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let padGain: GainNode | null = null;
let muted = false;

function now(): number {
  return ctx!.currentTime;
}

export function ensureCtx(): AudioContext {
  if (ctx) return ctx;
  const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new C();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : CONFIG.audio.masterGain;
  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.25;
  master.connect(compressor).connect(ctx.destination);
  startPad();
  return ctx;
}

function startPad() {
  if (!ctx || !master) return;
  padGain = ctx.createGain();
  padGain.gain.value = 0;
  padGain.connect(master);
  // Long attack fade-in so the pad never "starts" audibly.
  padGain.gain.linearRampToValueAtTime(0.22, now() + 8);

  const mkOsc = (freq: number, detune: number) => {
    const o = ctx!.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    o.detune.value = detune;
    // Very slow LFO on detune for breathing
    const lfo = ctx!.createOscillator();
    const lfoGain = ctx!.createGain();
    lfo.frequency.value = 0.05 + Math.random() * 0.04;
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain).connect(o.detune);
    lfo.start();
    o.connect(padGain!);
    o.start();
  };
  mkOsc(CONFIG.audio.padFreqA, -7);
  mkOsc(CONFIG.audio.padFreqA, +7);
  mkOsc(CONFIG.audio.padFreqB, -4);
  mkOsc(CONFIG.audio.padFreqB * 2, +9); // gentle shimmer on top
}

export function setPadIntensity(v: number) {
  if (!padGain || !ctx) return;
  const target = Math.max(0, Math.min(0.35, 0.14 + v * 0.2));
  padGain.gain.cancelScheduledValues(now());
  padGain.gain.linearRampToValueAtTime(target, now() + 2.5);
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) {
    master.gain.cancelScheduledValues(now());
    master.gain.linearRampToValueAtTime(m ? 0 : CONFIG.audio.masterGain, now() + 0.4);
  }
}

export function isMuted(): boolean {
  return muted;
}

export function chime(noteIndex?: number) {
  if (!ctx || !master || muted) return;
  const scale = CONFIG.audio.scale;
  const i = noteIndex ?? Math.floor(Math.random() * scale.length);
  const f = scale[Math.max(0, Math.min(scale.length - 1, i))];
  const t = now();

  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.value = f;

  const o2 = ctx.createOscillator(); // octave shimmer
  o2.type = "triangle";
  o2.frequency.value = f * 2;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(CONFIG.audio.chimeGain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);

  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0, t);
  g2.gain.linearRampToValueAtTime(CONFIG.audio.chimeGain * 0.35, t + 0.03);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);

  o.connect(g).connect(master);
  o2.connect(g2).connect(master);
  o.start(t);
  o2.start(t);
  o.stop(t + 2.3);
  o2.stop(t + 1.7);
}

/**
 * Rising shimmer arpeggio played once at the start of SCATTERING.
 */
export function scatterShimmer() {
  if (!ctx || !master || muted) return;
  const scale = CONFIG.audio.scale;
  const t0 = now();
  // bell arpeggio ascending through the pentatonic
  for (let i = 0; i < 8; i++) {
    const f = scale[i % scale.length] * (i >= scale.length ? 2 : 1);
    const o = ctx.createOscillator();
    o.type = i % 2 === 0 ? "sine" : "triangle";
    o.frequency.value = f;
    const g = ctx.createGain();
    const at = t0 + i * 0.18;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(CONFIG.audio.chimeGain * 0.7, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 2.0);
    o.connect(g).connect(master);
    o.start(at);
    o.stop(at + 2.1);
  }
  // filtered noise sweep under it
  const bufSize = 2 * ctx.sampleRate;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(500, t0);
  bp.frequency.exponentialRampToValueAtTime(3500, t0 + 2.2);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, t0);
  ng.gain.linearRampToValueAtTime(0.04, t0 + 0.2);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
  src.connect(bp).connect(ng).connect(master);
  src.start(t0);
  src.stop(t0 + 2.5);
}
