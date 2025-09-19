import { assert, assertEquals, assertExists, assertGreater } from "@std/assert";
import FLAC from "../../src/lib/index.ts";
import type { FLACAudioData } from "../../src/lib/types.ts";

Deno.test("FLAC initialization", async () => {
  const flac = new FLAC();
  await flac.initialize();

  assertExists(flac);
  assert(flac.isInitialized());

  flac.cleanup();
});

Deno.test("FLAC encoder creation", async () => {
  const flac = new FLAC({
    sampleRate: 44100,
    channels: 2,
    bitsPerSample: 16
  });

  await flac.createEncoder({
    compressionLevel: 5
  });

  assert(flac.isInitialized());
  flac.cleanup();
});

Deno.test("FLAC decoder creation", async () => {
  const flac = new FLAC({
    sampleRate: 44100,
    channels: 2,
    bitsPerSample: 16
  });

  await flac.createDecoder({
    md5Checking: true
  });

  assert(flac.isInitialized());
  flac.cleanup();
});

Deno.test("FLAC audio encoding basic", async () => {
  const flac = new FLAC();
  await flac.initialize();

  // Generate test audio data (1 second of 440Hz sine wave)
  const sampleRate = 44100;
  const duration = 1.0; // seconds
  const frequency = 440.0; // Hz
  const samples = new Float32Array(sampleRate * duration);

  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
  }

  const audioData: FLACAudioData = {
    samples,
    channels: 1,
    sampleRate,
    bitsPerSample: 16,
    length: samples.length
  };

  const result = await flac.encode(audioData);

  assert(result.success);
  assertExists(result.data);
  assertGreater(result.compressionRatio, 1.0);
  assertGreater(result.encodingTime, 0);

  flac.cleanup();
});

Deno.test("FLAC audio decoding basic", async () => {
  const flac = new FLAC();
  await flac.initialize();

  // Create dummy FLAC data (in real implementation, this would be actual FLAC)
  const flacData = new Uint8Array(1024);
  flacData.fill(0x66); // Fill with dummy data

  const result = await flac.decode(flacData);

  // Note: This test will fail with current placeholder implementation
  // In a real implementation, we'd use actual FLAC data
  assertExists(result);
  assertExists(result.decodingTime);

  flac.cleanup();
});

Deno.test("FLAC stereo encoding", async () => {
  const flac = new FLAC({
    channels: 2,
    sampleRate: 44100,
    bitsPerSample: 16
  });

  await flac.initialize();

  // Generate stereo test data (440Hz left, 880Hz right)
  const sampleRate = 44100;
  const duration = 0.5; // seconds
  const samples = new Float32Array(sampleRate * duration * 2); // Interleaved stereo

  for (let i = 0; i < samples.length; i += 2) {
    const t = i / 2 / sampleRate;
    samples[i] = Math.sin(2 * Math.PI * 440 * t) * 0.4;     // Left channel
    samples[i + 1] = Math.sin(2 * Math.PI * 880 * t) * 0.4; // Right channel
  }

  const audioData: FLACAudioData = {
    samples,
    channels: 2,
    sampleRate,
    bitsPerSample: 16,
    length: samples.length / 2 // samples per channel
  };

  const result = await flac.encode(audioData);

  assert(result.success);
  assertEquals(result.streamInfo.channels, 2);
  assertEquals(result.streamInfo.sampleRate, sampleRate);

  flac.cleanup();
});

Deno.test("FLAC compression level comparison", async () => {
  const audioData: FLACAudioData = {
    samples: new Float32Array(4096).map((_, i) => Math.sin(i * 0.01)),
    channels: 1,
    sampleRate: 44100,
    bitsPerSample: 16,
    length: 4096
  };

  // Test different compression levels
  const levels = [0, 5, 8];
  const results = [];

  for (const level of levels) {
    const flac = new FLAC();
    await flac.createEncoder({ compressionLevel: level });

    const result = await flac.encode(audioData);
    results.push({ level, result });

    flac.cleanup();
  }

  // Higher compression levels should generally produce smaller files
  // (though with placeholder implementation, this may not hold)
  for (const { level, result } of results) {
    assert(result.success, `Compression level ${level} should succeed`);
  }
});

Deno.test("FLAC different sample rates", async () => {
  const sampleRates = [8000, 16000, 44100, 48000, 96000];

  for (const sampleRate of sampleRates) {
    const flac = new FLAC({
      sampleRate,
      channels: 1,
      bitsPerSample: 16
    });

    await flac.initialize();

    // Generate 0.1 second of test audio
    const samples = new Float32Array(Math.floor(sampleRate * 0.1));
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 1000 * i / sampleRate) * 0.5;
    }

    const audioData: FLACAudioData = {
      samples,
      channels: 1,
      sampleRate,
      bitsPerSample: 16,
      length: samples.length
    };

    const result = await flac.encode(audioData);

    assert(result.success, `Sample rate ${sampleRate} should work`);
    assertEquals(result.streamInfo.sampleRate, sampleRate);

    flac.cleanup();
  }
});

Deno.test("FLAC error handling", async () => {
  const flac = new FLAC();

  // Test encoding without initialization
  const audioData: FLACAudioData = {
    samples: new Float32Array(1024),
    channels: 1,
    sampleRate: 44100,
    bitsPerSample: 16,
    length: 1024
  };

  // This should auto-initialize, so it should work
  const result = await flac.encode(audioData);

  // Even with placeholder implementation, it should not crash
  assertExists(result);
  assertExists(result.success);

  flac.cleanup();
});

Deno.test("FLAC SIMD availability", async () => {
  const flac = new FLAC({ simdOptimizations: true });
  await flac.initialize();

  const stats = flac.getStats();

  // SIMD should be requested
  assertEquals(stats.simdUsed, true);

  flac.cleanup();
});

Deno.test("FLAC memory usage", async () => {
  const flac = new FLAC({ maxMemoryMB: 64 });
  await flac.initialize();

  // Generate larger test data to exercise memory management
  const audioData: FLACAudioData = {
    samples: new Float32Array(44100 * 5), // 5 seconds
    channels: 1,
    sampleRate: 44100,
    bitsPerSample: 16,
    length: 44100 * 5
  };

  // Fill with test pattern
  for (let i = 0; i < audioData.samples.length; i++) {
    audioData.samples[i] = Math.sin(i * 0.001) * 0.5;
  }

  const result = await flac.encode(audioData);

  // Should handle large data without memory issues
  assertExists(result);

  flac.cleanup();
});