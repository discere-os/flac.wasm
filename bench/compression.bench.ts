import FLAC from "../src/lib/index.ts";
import type { FLACAudioData } from "../src/lib/types.ts";

let flacSIMD: FLAC;
let flacScalar: FLAC;
let testAudio: FLACAudioData;

// Setup before benchmarks
await (async () => {
  // Initialize SIMD version
  flacSIMD = new FLAC({ simdOptimizations: true });
  await flacSIMD.initialize();

  // Initialize scalar version
  flacScalar = new FLAC({ simdOptimizations: false });
  await flacScalar.initialize();

  // Generate test audio (1 second of complex signal)
  const sampleRate = 44100;
  const duration = 1.0;
  const samples = new Float32Array(sampleRate * duration);

  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    samples[i] =
      Math.sin(2 * Math.PI * 440 * t) * 0.4 +       // A4 fundamental
      Math.sin(2 * Math.PI * 880 * t) * 0.2 +       // First harmonic
      Math.sin(2 * Math.PI * 1320 * t) * 0.1 +      // Second harmonic
      Math.random() * 0.05;                          // Noise
  }

  testAudio = {
    samples,
    channels: 1,
    sampleRate,
    bitsPerSample: 16,
    length: samples.length
  };
})();

Deno.bench("FLAC encoding - SIMD optimized", async () => {
  await flacSIMD.encode(testAudio);
});

Deno.bench("FLAC encoding - Scalar fallback", async () => {
  await flacScalar.encode(testAudio);
});

Deno.bench("FLAC encoding - High compression (level 8)", async () => {
  const flacHigh = new FLAC({ simdOptimizations: true });
  await flacHigh.createEncoder({ compressionLevel: 8 });
  await flacHigh.encode(testAudio);
  flacHigh.cleanup();
});

Deno.bench("FLAC encoding - Fast compression (level 0)", async () => {
  const flacFast = new FLAC({ simdOptimizations: true });
  await flacFast.createEncoder({ compressionLevel: 0 });
  await flacFast.encode(testAudio);
  flacFast.cleanup();
});

Deno.bench("FLAC encoding - Stereo audio", async () => {
  const stereoSamples = new Float32Array(testAudio.samples.length * 2);
  for (let i = 0; i < testAudio.samples.length; i++) {
    stereoSamples[i * 2] = testAudio.samples[i];           // Left
    stereoSamples[i * 2 + 1] = testAudio.samples[i] * 0.8; // Right (slightly different)
  }

  const stereoAudio: FLACAudioData = {
    samples: stereoSamples,
    channels: 2,
    sampleRate: testAudio.sampleRate,
    bitsPerSample: 16,
    length: testAudio.samples.length
  };

  await flacSIMD.encode(stereoAudio);
});

Deno.bench("FLAC encoding - 24-bit audio", async () => {
  const flac24 = new FLAC({
    simdOptimizations: true,
    bitsPerSample: 24
  });
  await flac24.initialize();

  const audio24: FLACAudioData = {
    ...testAudio,
    bitsPerSample: 24
  };

  await flac24.encode(audio24);
  flac24.cleanup();
});

Deno.bench("FLAC encoding - 48kHz sample rate", async () => {
  const flac48k = new FLAC({
    simdOptimizations: true,
    sampleRate: 48000
  });
  await flac48k.initialize();

  // Generate 48kHz test audio
  const samples48k = new Float32Array(48000); // 1 second
  for (let i = 0; i < samples48k.length; i++) {
    const t = i / 48000;
    samples48k[i] = Math.sin(2 * Math.PI * 1000 * t) * 0.5;
  }

  const audio48k: FLACAudioData = {
    samples: samples48k,
    channels: 1,
    sampleRate: 48000,
    bitsPerSample: 16,
    length: samples48k.length
  };

  await flac48k.encode(audio48k);
  flac48k.cleanup();
});

Deno.bench("FLAC encoding - Large buffer (10 seconds)", async () => {
  const largeSamples = new Float32Array(44100 * 10); // 10 seconds
  for (let i = 0; i < largeSamples.length; i++) {
    const t = i / 44100;
    largeSamples[i] = Math.sin(2 * Math.PI * 440 * t) * 0.5;
  }

  const largeAudio: FLACAudioData = {
    samples: largeSamples,
    channels: 1,
    sampleRate: 44100,
    bitsPerSample: 16,
    length: largeSamples.length
  };

  await flacSIMD.encode(largeAudio);
});

Deno.bench("FLAC decoding - SIMD optimized", async () => {
  // Create dummy FLAC data for decoding test
  const flacData = new Uint8Array(8192);
  flacData.fill(0x66); // Fill with dummy data

  await flacSIMD.decode(flacData);
});

Deno.bench("FLAC initialization overhead", async () => {
  const flac = new FLAC();
  await flac.initialize();
  flac.cleanup();
});

Deno.bench("FLAC memory allocation/deallocation", async () => {
  const flac = new FLAC();
  await flac.initialize();

  // Test memory operations with medium-sized buffer
  const samples = new Float32Array(8192);
  samples.fill(0.5);

  const audioData: FLACAudioData = {
    samples,
    channels: 1,
    sampleRate: 44100,
    bitsPerSample: 16,
    length: 8192
  };

  await flac.encode(audioData);
  flac.cleanup();
});

// Cleanup after benchmarks
globalThis.addEventListener("unload", () => {
  flacSIMD?.cleanup();
  flacScalar?.cleanup();
});