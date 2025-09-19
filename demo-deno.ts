#!/usr/bin/env -S deno run --allow-read --allow-write

import FLAC from "./src/lib/index.ts";
import type { FLACAudioData, FLACEncoderOptions } from "./src/lib/types.ts";

async function generateTestAudio(
  frequency: number,
  duration: number,
  sampleRate: number,
  channels: number
): Promise<FLACAudioData> {
  const samplesPerChannel = Math.floor(sampleRate * duration);
  const totalSamples = samplesPerChannel * channels;
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < samplesPerChannel; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.5;

    if (channels === 1) {
      samples[i] = sample;
    } else {
      // Stereo - slightly different frequencies for left/right
      samples[i * 2] = sample;
      samples[i * 2 + 1] = Math.sin(2 * Math.PI * (frequency * 1.01) * t) * 0.5;
    }
  }

  return {
    samples,
    channels,
    sampleRate,
    bitsPerSample: 16,
    length: samplesPerChannel
  };
}

async function demo() {
  console.log("🎵 FLAC.wasm Demo");
  console.log("=" + "=".repeat(50));

  try {
    // Initialize FLAC
    console.log("\n📦 Initializing FLAC WebAssembly module...");
    const flac = new FLAC({
      simdOptimizations: true,
      maxMemoryMB: 128
    });

    await flac.initialize();
    console.log("✅ FLAC initialized successfully");

    // Display SIMD availability
    const stats = flac.getStats();
    console.log(`🚀 SIMD optimizations: ${stats.simdUsed ? "Enabled" : "Disabled"}`);

    // Generate test audio
    console.log("\n🎼 Generating test audio...");
    const audioData = await generateTestAudio(
      440,    // A4 note
      2.0,    // 2 seconds
      44100,  // CD quality
      2       // Stereo
    );

    console.log(`   Sample rate: ${audioData.sampleRate} Hz`);
    console.log(`   Channels: ${audioData.channels}`);
    console.log(`   Duration: ${audioData.length / audioData.sampleRate} seconds`);
    console.log(`   Samples: ${audioData.samples.length.toLocaleString()}`);

    // Test different compression levels
    console.log("\n🔧 Testing compression levels...");

    const compressionLevels = [0, 5, 8];
    const results = [];

    for (const level of compressionLevels) {
      console.log(`\n   Level ${level}:`);

      await flac.createEncoder({
        compressionLevel: level,
        adaptiveMidSide: true,
        looseMidSide: true
      } as FLACEncoderOptions);

      const startTime = performance.now();
      const result = await flac.encode(audioData);
      const elapsed = performance.now() - startTime;

      if (result.success) {
        const compressionRatio = result.compressionRatio;
        const throughput = (audioData.samples.length / elapsed) * 1000;

        console.log(`     ✅ Success`);
        console.log(`     📊 Compression ratio: ${compressionRatio.toFixed(2)}:1`);
        console.log(`     ⏱️  Encoding time: ${elapsed.toFixed(1)}ms`);
        console.log(`     🚄 Throughput: ${(throughput / 1000000).toFixed(2)} MSamples/sec`);
        console.log(`     💾 Output size: ${result.data.length.toLocaleString()} bytes`);

        results.push({
          level,
          ratio: compressionRatio,
          time: elapsed,
          throughput: throughput
        });
      } else {
        console.log(`     ❌ Failed: ${result.error}`);
      }
    }

    // Performance comparison
    console.log("\n📈 Performance Summary:");
    console.log("   Level | Ratio  | Time (ms) | Throughput (MSamples/sec)");
    console.log("   ------|--------|-----------|-------------------------");

    for (const result of results) {
      const ratio = result.ratio.toFixed(2).padStart(6);
      const time = result.time.toFixed(1).padStart(9);
      const throughput = (result.throughput / 1000000).toFixed(2).padStart(24);
      console.log(`      ${result.level}  |${ratio}  |${time}   |${throughput}`);
    }

    // Test different audio formats
    console.log("\n🎚️ Testing different audio formats...");

    const formats = [
      { sampleRate: 8000, channels: 1, bitsPerSample: 16, name: "Phone quality" },
      { sampleRate: 22050, channels: 1, bitsPerSample: 16, name: "AM radio quality" },
      { sampleRate: 44100, channels: 2, bitsPerSample: 16, name: "CD quality" },
      { sampleRate: 48000, channels: 2, bitsPerSample: 24, name: "Studio quality" },
      { sampleRate: 96000, channels: 2, bitsPerSample: 24, name: "Hi-res audio" }
    ];

    for (const format of formats) {
      try {
        const formatFlac = new FLAC({
          sampleRate: format.sampleRate,
          channels: format.channels,
          bitsPerSample: format.bitsPerSample,
          simdOptimizations: true
        });

        await formatFlac.initialize();

        const testAudio = await generateTestAudio(
          1000, // 1kHz test tone
          0.5,  // 0.5 seconds
          format.sampleRate,
          format.channels
        );

        const startTime = performance.now();
        const result = await formatFlac.encode(testAudio);
        const elapsed = performance.now() - startTime;

        if (result.success) {
          console.log(`   ${format.name}: ✅ ${elapsed.toFixed(1)}ms (${result.compressionRatio.toFixed(2)}:1)`);
        } else {
          console.log(`   ${format.name}: ❌ Failed`);
        }

        formatFlac.cleanup();
      } catch (error) {
        console.log(`   ${format.name}: ❌ Error: ${error}`);
      }
    }

    // Memory usage test
    console.log("\n💾 Memory usage test...");
    console.log("   Processing 10 seconds of stereo audio...");

    const largeAudio = await generateTestAudio(
      440,    // A4 note
      10.0,   // 10 seconds
      44100,  // CD quality
      2       // Stereo
    );

    const memStartTime = performance.now();
    const memResult = await flac.encode(largeAudio);
    const memElapsed = performance.now() - memStartTime;

    if (memResult.success) {
      const audioSizeMB = (largeAudio.samples.length * 4) / (1024 * 1024);
      const outputSizeMB = memResult.data.length / (1024 * 1024);
      const realTimeRatio = (largeAudio.length / largeAudio.sampleRate) / (memElapsed / 1000);

      console.log(`   ✅ Success`);
      console.log(`   📊 Input: ${audioSizeMB.toFixed(2)} MB -> Output: ${outputSizeMB.toFixed(2)} MB`);
      console.log(`   ⚡ Real-time performance: ${realTimeRatio.toFixed(2)}x`);
      console.log(`   🕐 Processing time: ${memElapsed.toFixed(0)}ms`);
    } else {
      console.log(`   ❌ Failed: ${memResult.error}`);
    }

    // Cleanup
    flac.cleanup();
    console.log("\n🧹 Cleanup completed");

    // Final statistics
    const finalStats = flac.getStats();
    console.log("\n📊 Final Statistics:");
    console.log(`   Frames processed: ${finalStats.framesProcessed.toLocaleString()}`);
    console.log(`   Samples processed: ${finalStats.samplesProcessed.toLocaleString()}`);
    console.log(`   Average bits per sample: ${finalStats.averageBitsPerSample.toFixed(2)}`);
    console.log(`   Total processing time: ${finalStats.processingTime.toFixed(0)}ms`);
    console.log(`   SIMD optimizations used: ${finalStats.simdUsed ? "Yes" : "No"}`);

  } catch (error) {
    console.error("❌ Demo failed:", error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
  }

  console.log("\n🎉 Demo completed!");
}

if (import.meta.main) {
  await demo();
}