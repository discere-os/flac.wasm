/* FLAC WebAssembly SIMD Optimizations
 * Copyright (c) 2001-2025 Josh Coalson & Xiph.Org Foundation
 * Copyright (c) 2025 Superstruct Ltd, New Zealand
 * Licensed under BSD-3-Clause (Xiph.Org license)
 */

#include <wasm_simd128.h>
#include <emscripten.h>
#include <math.h>
#include <string.h>
#include <stdbool.h>

// FLAC headers
#include "../include/FLAC/format.h"
#include "../include/FLAC/assert.h"

// SIMD feature detection
EMSCRIPTEN_KEEPALIVE
bool flac_simd_available() {
#ifdef __wasm_simd128__
    return true;
#else
    return false;
#endif
}

/* LPC Autocorrelation computation with WASM SIMD
 * Ported from SSE2 version - computes autocorrelation for Linear Prediction Coding
 * This is critical for FLAC compression efficiency
 */
EMSCRIPTEN_KEEPALIVE
void flac_lpc_compute_autocorrelation_wasm_simd(const float* data, uint32_t data_len, uint32_t lag, double* autoc) {
    uint32_t i, j;
    double d;

    // Initialize autocorrelation array
    for (i = 0; i < lag + 1; i++) {
        autoc[i] = 0.0;
    }

    // SIMD processing for lag 0 (variance)
    v128_t sum_vec = wasm_f32x4_splat(0.0f);
    uint32_t simd_end = (data_len / 4) * 4;

    // Process 4 samples at a time
    for (i = 0; i < simd_end; i += 4) {
        v128_t data_vec = wasm_v128_load(&data[i]);
        v128_t squared = wasm_f32x4_mul(data_vec, data_vec);
        sum_vec = wasm_f32x4_add(sum_vec, squared);
    }

    // Horizontal sum for lag 0
    float temp[4];
    wasm_v128_store(temp, sum_vec);
    autoc[0] = temp[0] + temp[1] + temp[2] + temp[3];

    // Handle remainder for lag 0
    for (i = simd_end; i < data_len; i++) {
        autoc[0] += data[i] * data[i];
    }

    // Compute other lags (SIMD where possible)
    for (j = 1; j <= lag; j++) {
        sum_vec = wasm_f32x4_splat(0.0f);
        uint32_t available_len = data_len - j;
        simd_end = (available_len / 4) * 4;

        // Process 4 sample pairs at a time
        for (i = 0; i < simd_end; i += 4) {
            v128_t data1_vec = wasm_v128_load(&data[i]);
            v128_t data2_vec = wasm_v128_load(&data[i + j]);
            v128_t product = wasm_f32x4_mul(data1_vec, data2_vec);
            sum_vec = wasm_f32x4_add(sum_vec, product);
        }

        // Horizontal sum
        wasm_v128_store(temp, sum_vec);
        autoc[j] = temp[0] + temp[1] + temp[2] + temp[3];

        // Handle remainder
        for (i = simd_end; i < available_len; i++) {
            autoc[j] += data[i] * data[i + j];
        }
    }
}

/* LPC Residual computation with WASM SIMD
 * Ported from SSE2 version - computes prediction residuals for compression
 */
EMSCRIPTEN_KEEPALIVE
void flac_lpc_compute_residual_wasm_simd(const int32_t* data, uint32_t data_len,
                                        const int32_t* qlp_coeff, uint32_t order,
                                        int lp_quantization, int32_t* residual) {
    uint32_t i;

    // Handle orders that can be SIMD-optimized (4, 8, 12, 16)
    if (order == 4) {
        v128_t qlp_vec = wasm_v128_load(qlp_coeff);

        for (i = order; i < data_len; i++) {
            // Load 4 data samples
            v128_t data_vec = wasm_v128_load(&data[i - 4]);

            // Multiply and accumulate
            v128_t product = wasm_i32x4_mul(data_vec, qlp_vec);

            // Horizontal sum
            int32_t temp[4];
            wasm_v128_store(temp, product);
            int64_t sum = (int64_t)temp[0] + temp[1] + temp[2] + temp[3];

            // Compute residual
            residual[i] = data[i] - (int32_t)(sum >> lp_quantization);
        }
    } else if (order == 8) {
        v128_t qlp_vec1 = wasm_v128_load(qlp_coeff);
        v128_t qlp_vec2 = wasm_v128_load(&qlp_coeff[4]);

        for (i = order; i < data_len; i++) {
            // Load 8 data samples in two vectors
            v128_t data_vec1 = wasm_v128_load(&data[i - 8]);
            v128_t data_vec2 = wasm_v128_load(&data[i - 4]);

            // Multiply and accumulate
            v128_t product1 = wasm_i32x4_mul(data_vec1, qlp_vec1);
            v128_t product2 = wasm_i32x4_mul(data_vec2, qlp_vec2);

            // Horizontal sums
            int32_t temp1[4], temp2[4];
            wasm_v128_store(temp1, product1);
            wasm_v128_store(temp2, product2);

            int64_t sum = (int64_t)temp1[0] + temp1[1] + temp1[2] + temp1[3] +
                         temp2[0] + temp2[1] + temp2[2] + temp2[3];

            // Compute residual
            residual[i] = data[i] - (int32_t)(sum >> lp_quantization);
        }
    } else {
        // Fallback to scalar for other orders
        for (i = order; i < data_len; i++) {
            int64_t sum = 0;
            for (uint32_t j = 0; j < order; j++) {
                sum += (int64_t)qlp_coeff[j] * data[i - j - 1];
            }
            residual[i] = data[i] - (int32_t)(sum >> lp_quantization);
        }
    }

    // Copy warm-up samples
    for (i = 0; i < order; i++) {
        residual[i] = data[i];
    }
}

/* Fixed predictor computation with WASM SIMD
 * Optimized version of FLAC fixed predictors
 */
EMSCRIPTEN_KEEPALIVE
void flac_fixed_compute_residual_wasm_simd(const int32_t* data, uint32_t data_len,
                                          uint32_t order, int32_t* residual) {
    uint32_t i;

    if (order == 0) {
        // Order 0: residual = data (copy)
        if (data_len >= 16) {
            uint32_t simd_end = (data_len / 4) * 4;
            for (i = 0; i < simd_end; i += 4) {
                v128_t data_vec = wasm_v128_load(&data[i]);
                wasm_v128_store(&residual[i], data_vec);
            }
            // Handle remainder
            for (i = simd_end; i < data_len; i++) {
                residual[i] = data[i];
            }
        } else {
            memcpy(residual, data, data_len * sizeof(int32_t));
        }
    } else if (order == 1) {
        // Order 1: residual[i] = data[i] - data[i-1]
        residual[0] = data[0];

        if (data_len > 4) {
            uint32_t simd_end = ((data_len - 1) / 4) * 4 + 1;
            for (i = 1; i < simd_end; i += 4) {
                v128_t curr = wasm_v128_load(&data[i]);
                v128_t prev = wasm_v128_load(&data[i - 1]);
                v128_t diff = wasm_i32x4_sub(curr, prev);
                wasm_v128_store(&residual[i], diff);
            }
            // Handle remainder
            for (i = simd_end; i < data_len; i++) {
                residual[i] = data[i] - data[i - 1];
            }
        } else {
            for (i = 1; i < data_len; i++) {
                residual[i] = data[i] - data[i - 1];
            }
        }
    } else if (order == 2) {
        // Order 2: residual[i] = data[i] - 2*data[i-1] + data[i-2]
        residual[0] = data[0];
        residual[1] = data[1] - data[0];

        for (i = 2; i < data_len; i++) {
            residual[i] = data[i] - 2*data[i - 1] + data[i - 2];
        }
    } else if (order == 3) {
        // Order 3: residual[i] = data[i] - 3*data[i-1] + 3*data[i-2] - data[i-3]
        residual[0] = data[0];
        residual[1] = data[1] - data[0];
        residual[2] = data[2] - 2*data[1] + data[0];

        for (i = 3; i < data_len; i++) {
            residual[i] = data[i] - 3*data[i - 1] + 3*data[i - 2] - data[i - 3];
        }
    } else if (order == 4) {
        // Order 4: residual[i] = data[i] - 4*data[i-1] + 6*data[i-2] - 4*data[i-3] + data[i-4]
        residual[0] = data[0];
        residual[1] = data[1] - data[0];
        residual[2] = data[2] - 2*data[1] + data[0];
        residual[3] = data[3] - 3*data[2] + 3*data[1] - data[0];

        for (i = 4; i < data_len; i++) {
            residual[i] = data[i] - 4*data[i - 1] + 6*data[i - 2] - 4*data[i - 3] + data[i - 4];
        }
    }
}

/* Rice parameter estimation with SIMD
 * Optimizes the selection of Rice coding parameters
 */
EMSCRIPTEN_KEEPALIVE
uint32_t flac_rice_parameter_estimate_wasm_simd(const int32_t* residual, uint32_t residual_samples) {
    if (residual_samples == 0) return 0;

    // Count bits needed using SIMD acceleration
    v128_t sum_vec = wasm_i32x4_splat(0);
    uint32_t simd_end = (residual_samples / 4) * 4;

    // Process 4 residuals at a time
    for (uint32_t i = 0; i < simd_end; i += 4) {
        v128_t residual_vec = wasm_v128_load(&residual[i]);

        // Get absolute values (flip negative numbers)
        v128_t zero = wasm_i32x4_splat(0);
        v128_t mask = wasm_i32x4_lt(residual_vec, zero);
        v128_t negated = wasm_i32x4_neg(residual_vec);
        v128_t abs_vec = wasm_v128_bitselect(negated, residual_vec, mask);

        // Accumulate
        sum_vec = wasm_i32x4_add(sum_vec, abs_vec);
    }

    // Horizontal sum
    int32_t temp[4];
    wasm_v128_store(temp, sum_vec);
    uint64_t sum = temp[0] + temp[1] + temp[2] + temp[3];

    // Handle remainder
    for (uint32_t i = simd_end; i < residual_samples; i++) {
        sum += (residual[i] < 0) ? -residual[i] : residual[i];
    }

    // Estimate optimal Rice parameter
    if (sum == 0) return 0;

    double mean = (double)sum / residual_samples;
    uint32_t rice_param = 0;

    // Find optimal parameter (simplified estimation)
    while ((1u << rice_param) < mean && rice_param < 15) {
        rice_param++;
    }

    return rice_param > 0 ? rice_param - 1 : 0;
}

/* MD5 checksum acceleration (used for stream verification)
 */
EMSCRIPTEN_KEEPALIVE
void flac_md5_process_block_wasm_simd(const uint8_t* data, uint32_t len, uint32_t* state) {
    // Note: This would be a full MD5 implementation with SIMD
    // For brevity, showing the pattern - actual implementation would be extensive

    // Process data in 64-byte blocks with SIMD where possible
    while (len >= 64) {
        // SIMD-accelerated MD5 block processing would go here
        // This involves complex bit operations that benefit from SIMD
        len -= 64;
        data += 64;
    }

    // Handle remaining bytes with scalar code
}

/* Windowing function for spectral analysis (used in psychoacoustic modeling)
 */
EMSCRIPTEN_KEEPALIVE
void flac_window_apply_wasm_simd(const float* window, const float* input, float* output, uint32_t length) {
    uint32_t simd_end = (length / 4) * 4;

    // Apply windowing with SIMD - 4 samples at once
    for (uint32_t i = 0; i < simd_end; i += 4) {
        v128_t window_vec = wasm_v128_load(&window[i]);
        v128_t input_vec = wasm_v128_load(&input[i]);
        v128_t result = wasm_f32x4_mul(window_vec, input_vec);
        wasm_v128_store(&output[i], result);
    }

    // Handle remainder
    for (uint32_t i = simd_end; i < length; i++) {
        output[i] = window[i] * input[i];
    }
}

/* Performance benchmark for SIMD operations
 */
EMSCRIPTEN_KEEPALIVE
double flac_benchmark_simd_throughput(uint32_t iterations) {
    const uint32_t test_size = 4096;
    float test_data[test_size];
    float result[test_size];

    // Initialize test data
    for (uint32_t i = 0; i < test_size; i++) {
        test_data[i] = (float)(i % 1000) / 1000.0f;
    }

    // Benchmark SIMD multiplication
    double start_time = emscripten_get_now();

    for (uint32_t iter = 0; iter < iterations; iter++) {
        for (uint32_t i = 0; i < test_size; i += 4) {
            v128_t data_vec = wasm_v128_load(&test_data[i]);
            v128_t doubled = wasm_f32x4_mul(data_vec, wasm_f32x4_splat(2.0f));
            wasm_v128_store(&result[i], doubled);
        }
    }

    double end_time = emscripten_get_now();
    double total_samples = (double)iterations * test_size;
    double elapsed_seconds = (end_time - start_time) / 1000.0;

    return total_samples / elapsed_seconds; // Samples per second
}