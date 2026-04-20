/**
 * Single source of truth for tuning. Prefer editing CONFIG over hard-coding
 * numbers in gameplay code.
 */
export const CONFIG = {
  width: 960,
  height: 720,

  basket: {
    width: 160,
    height: 90,
    speed: 520, // px/s when keyboard axis is full
    easeToTouch: 0.08, // per frame at 60fps
    capacity: 24,
    yMargin: 60, // distance from bottom
    color: 0xb98a55,
    rimColor: 0x8c6239,
    weaveColor: 0xe0b379,
    fillGlow: 0xffe2a1,
  },

  stars: {
    poolSize: 120,
    spawnEveryMin: 0.45, // seconds
    spawnEveryMax: 1.1,
    fallMin: 18, // px/s — slow, calming
    fallMax: 42,
    radiusMin: 5,
    radiusMax: 11,
    driftAmp: 22, // horizontal wander amplitude
    driftSpeedMin: 0.2,
    driftSpeedMax: 0.7,
    twinkleSpeed: 2.4,
    color: 0xfff4c2,
    coreColor: 0xffffff,
    haloColor: 0xffd98b,
  },

  particles: {
    poolSize: 600,
    lifeMin: 0.6,
    lifeMax: 1.8,
  },

  scene: {
    minDuration: 35,
    maxDuration: 55,
    crossfadeSeconds: 4,
    sphereEvery: 6, // 1-in-N cycles becomes the SPHERE surprise
  },

  scatter: {
    duration: 5.2,
    minFillFraction: 0.5,
    outwardSpeed: 140,
  },

  dream: {
    idleSeconds: 180,
    fadeSeconds: 8,
  },

  audio: {
    // pentatonic major — chimes can never clash
    scale: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25],
    padFreqA: 110.0, // A2
    padFreqB: 164.81, // E3
    masterGain: 0.5,
    chimeGain: 0.12,
  },

  hud: {
    meterColor: 0xffe2a1,
    meterBgColor: 0x2a2450,
    hintColor: 0xdadaff,
  },

  storage: {
    key: "sternensammler/v1",
  },

  palettes: {
    dusk: {
      top: 0x1a1436,
      mid: 0x573a6a,
      horizon: 0xe69b6b,
      sunCore: 0xffd0a3,
      sunHalo: 0xffad6b,
      star: 0xfff0c2,
    },
    night: {
      top: 0x05071c,
      mid: 0x0c1140,
      horizon: 0x1a2050,
      moon: 0xe8e0ff,
      star: 0xffffff,
    },
    cosmic: {
      top: 0x070423,
      mid: 0x1a1055,
      horizon: 0x2c1d66,
      planetA: 0xb07bff,
      planetB: 0x55c2ff,
      planetC: 0xff9fd6,
      star: 0xeaeaff,
    },
    sphere: {
      space: 0x030316,
      planet: 0x2c3a88,
      planetHi: 0x5b78d2,
      planetAtmos: 0x8ec0ff,
      horizon: 0xfff0c2,
      star: 0xfff0c2,
    },
  },
} as const;

export type Config = typeof CONFIG;
