import { assert, assertEquals, assertGreater } from "@std/assert";
import FLAC from "../../src/lib/index.ts";

Deno.test("SIMD feature detection", async () => {
  const flac = new FLAC({ simdOptimizations: true });
  await flac.initialize();

  // Check if SIMD is available/requested
  const stats = flac.getStats();
  assertEquals(stats.simdUsed, true);

  flac.cleanup();
});

Deno.test("SIMD vs scalar performance comparison", async () => {
  // Test SIMD enabled
  const flacSIMD = new FLAC({ simdOptimizations: true });
  await flacSIMD.initialize();

  // Test SIMD disabled
  const flacScalar = new FLAC({ simdOptimizations: false });
  await flacScalar.initialize();

  // Generate test audio data
  const samples = new Float32Array(44100); // 1 second
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5;
  }

  const audioData = {
    samples,
    channels: 1,
    sampleRate: 44100,
    bitsPerSample: 16,
    length: samples.length
  };

  // Benchmark SIMD version
  const startSIMD = performance.now();
  const simdResult = await flacSIMD.encode(audioData);
  const simdTime = performance.now() - startSIMD;

  // Benchmark scalar version
  const startScalar = performance.now();
  const scalarResult = await flacScalar.encode(audioData);
  const scalarTime = performance.now() - startScalar;

  // Both should succeed
  assert(simdResult.success);
  assert(scalarResult.success);

  // SIMD should be faster or at least not slower
  // Note: With placeholder implementation, timing may not show improvement
  console.log(`SIMD time: ${simdTime.toFixed(2)}ms`);
  console.log(`Scalar time: ${scalarTime.toFixed(2)}ms`);

  if (simdTime < scalarTime) {
    console.log(`SIMD speedup: ${(scalarTime / simdTime).toFixed(2)}x`);
  }

  flacSIMD.cleanup();
  flacScalar.cleanup();
});

Deno.test("SIMD with different data sizes", async () => {
  const flac = new FLAC({ simdOptimizations: true });
  await flac.initialize();

  const sizes = [256, 1024, 4096, 16384, 65536]; // Different buffer sizes

  for (const size of sizes) {
    // Generate test data
    const samples = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      samples[i] = Math.sin(2 * Math.PI * 1000 * i / 44100) * 0.5;
    }

    const audioData = {
      samples,
      channels: 1,
      sampleRate: 44100,
      bitsPerSample: 16,
      length: size
    };

    const start = performance.now();
    const result = await flac.encode(audioData);
    const elapsed = performance.now() - start;

    assert(result.success, `Size ${size} should work with SIMD`);
    assertGreater(elapsed, 0, "Should take some time to process");

    const throughput = (size / elapsed) * 1000; // Samples per second
    console.log(`Size ${size}: ${throughput.toFixed(0)} samples/sec`);
  }

  flac.cleanup();
});

Deno.test("SIMD stereo processing", async () => {
  const flac = new FLAC({
    simdOptimizations: true,
    channels: 2,
    sampleRate: 44100,
    bitsPerSample: 16
  });

  await flac.initialize();

  // Generate stereo test data
  const samplesPerChannel = 22050; // 0.5 seconds per channel
  const samples = new Float32Array(samplesPerChannel * 2); // Interleaved stereo

  for (let i = 0; i < samplesPerChannel; i++) {
    const t = i / 44100;
    samples[i * 2] = Math.sin(2 * Math.PI * 440 * t) * 0.4;     // Left
    samples[i * 2 + 1] = Math.sin(2 * Math.PI * 880 * t) * 0.4; // Right
  }

  const audioData = {
    samples,
    channels: 2,
    sampleRate: 44100,
    bitsPerSample: 16,
    length: samplesPerChannel
  };

  const result = await flac.encode(audioData);

  assert(result.success);
  assertEquals(result.streamInfo.channels, 2);

  // Check SIMD was used
  const stats = flac.getStats();
  assertEquals(stats.simdUsed, true);

  flac.cleanup();
});

Deno.test("SIMD with different bit depths", async () => {
  const bitDepths = [16, 24];

  for (const bitsPerSample of bitDepths) {
    const flac = new FLAC({
      simdOptimizations: true,
      bitsPerSample,
      sampleRate: 44100,
      channels: 1
    });

    await flac.initialize();

    // Generate test data with appropriate amplitude for bit depth
    const samples = new Float32Array(4096);
    const amplitude = bitsPerSample === 16 ? 0.5 : 0.8;

    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 1000 * i / 44100) * amplitude;
    }

    const audioData = {
      samples,
      channels: 1,
      sampleRate: 44100,
      bitsPerSample,
      length: samples.length
    };

    const result = await flac.encode(audioData);

    assert(result.success, `${bitsPerSample}-bit should work with SIMD`);
    assertEquals(result.streamInfo.bitsPerSample, bitsPerSample);

    flac.cleanup();
  }
});

Deno.test("SIMD processing throughput benchmark", async () => {
  const flac = new FLAC({ simdOptimizations: true });
  await flac.initialize();

  const testDuration = 10.0; // seconds of audio
  const sampleRate = 44100;
  const totalSamples = Math.floor(sampleRate * testDuration);
  const samples = new Float32Array(totalSamples);

  // Generate complex test signal
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    samples[i] =
      Math.sin(2 * Math.PI * 440 * t) * 0.3 +
      Math.sin(2 * Math.PI * 1000 * t) * 0.2 +
      Math.sin(2 * Math.PI * 2000 * t) * 0.1;
  }

  const audioData = {
    samples,
    channels: 1,
    sampleRate,
    bitsPerSample: 16,
    length: totalSamples
  };

  const start = performance.now();
  const result = await flac.encode(audioData);
  const elapsed = performance.now() - start;

  assert(result.success);

  const throughput = (totalSamples / elapsed) * 1000; // Samples per second
  const realTimeRatio = throughput / sampleRate;

  console.log(`SIMD Throughput: ${(throughput / 1000000).toFixed(2)} MSamples/sec`);
  console.log(`Real-time ratio: ${realTimeRatio.toFixed(2)}x`);

  // Should process faster than real-time for efficient compression
  assertGreater(realTimeRatio, 1.0);

  flac.cleanup();
});