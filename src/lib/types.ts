/**
 * FLAC WebAssembly TypeScript Definitions
 * Copyright (c) 2001-2025 Josh Coalson & Xiph.Org Foundation
 * Copyright (c) 2025 Superstruct Ltd, New Zealand
 * Licensed under BSD-3-Clause (Xiph.Org license)
 */

/**
 * FLAC stream metadata types
 */
export type FLACMetadataType =
  | 'STREAMINFO'
  | 'PADDING'
  | 'APPLICATION'
  | 'SEEKTABLE'
  | 'VORBIS_COMMENT'
  | 'CUESHEET'
  | 'PICTURE'
  | 'UNKNOWN';

/**
 * FLAC stream information
 */
export interface FLACStreamInfo {
  /** Minimum block size (in samples) used in the stream */
  minBlockSize: number;
  /** Maximum block size (in samples) used in the stream */
  maxBlockSize: number;
  /** Minimum frame size (in bytes) used in the stream (0 if unknown) */
  minFrameSize: number;
  /** Maximum frame size (in bytes) used in the stream (0 if unknown) */
  maxFrameSize: number;
  /** Sample rate in samples per second */
  sampleRate: number;
  /** Number of channels (1-8) */
  channels: number;
  /** Bits per sample (4-32) */
  bitsPerSample: number;
  /** Total number of samples in the stream (0 if unknown) */
  totalSamples: number;
  /** MD5 sum of unencoded audio data */
  md5sum: Uint8Array;
}

/**
 * FLAC encoder/decoder options
 */
export interface FLACOptions {
  /** Use SIMD optimizations if available */
  simdOptimizations?: boolean;
  /** Maximum memory usage in MB */
  maxMemoryMB?: number;
  /** Sample rate (8000-655350 Hz) */
  sampleRate?: number;
  /** Number of channels (1-8) */
  channels?: number;
  /** Bits per sample (4-32, typically 16 or 24) */
  bitsPerSample?: number;
  /** Block size (16-65535 samples) */
  blockSize?: number;
}

/**
 * FLAC encoder-specific options
 */
export interface FLACEncoderOptions extends FLACOptions {
  /** Compression level (0-8, default 5) */
  compressionLevel?: number;
  /** Enable loose mid-side stereo */
  looseMidSide?: boolean;
  /** Enable adaptive mid-side */
  adaptiveMidSide?: boolean;
  /** Enable exhaustive model search */
  exhaustiveModelSearch?: boolean;
  /** Minimum residual partition order (0-15) */
  minResidualPartitionOrder?: number;
  /** Maximum residual partition order (0-15) */
  maxResidualPartitionOrder?: number;
  /** Maximum LPC order (0-32) */
  maxLPCOrder?: number;
  /** Use QLP coefficient precision search */
  qlpCoeffPrecisionSearch?: boolean;
  /** QLP coefficient precision (0-15) */
  qlpCoeffPrecision?: number;
}

/**
 * FLAC decoder-specific options
 */
export interface FLACDecoderOptions extends FLACOptions {
  /** Enable MD5 checking */
  md5Checking?: boolean;
}

/**
 * Audio data for processing
 */
export interface FLACAudioData {
  /** Raw audio samples (interleaved for multi-channel) */
  samples: Float32Array | Int16Array | Int32Array;
  /** Number of channels */
  channels: number;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Bits per sample */
  bitsPerSample: number;
  /** Number of samples per channel */
  length: number;
}

/**
 * FLAC encoding result
 */
export interface FLACEncodeResult {
  /** Success status */
  success: boolean;
  /** Encoded FLAC data */
  data: Uint8Array;
  /** Compression ratio achieved */
  compressionRatio: number;
  /** Encoding time in milliseconds */
  encodingTime: number;
  /** Stream information */
  streamInfo: FLACStreamInfo;
  /** Any error message */
  error?: string;
}

/**
 * FLAC decoding result
 */
export interface FLACDecodeResult {
  /** Success status */
  success: boolean;
  /** Decoded audio data */
  audioData: FLACAudioData;
  /** Stream information */
  streamInfo: FLACStreamInfo;
  /** Decoding time in milliseconds */
  decodingTime: number;
  /** Any error message */
  error?: string;
}

/**
 * FLAC metadata result
 */
export interface FLACMetadata {
  /** Metadata type */
  type: FLACMetadataType;
  /** Stream information (if type is STREAMINFO) */
  streamInfo?: FLACStreamInfo;
  /** Vorbis comments (if type is VORBIS_COMMENT) */
  vorbisComments?: Record<string, string>;
  /** Raw metadata data */
  data: Uint8Array;
}

/**
 * FLAC stream statistics
 */
export interface FLACStats {
  /** Total frames processed */
  framesProcessed: number;
  /** Total samples processed */
  samplesProcessed: number;
  /** Average bits per sample achieved */
  averageBitsPerSample: number;
  /** Processing time in milliseconds */
  processingTime: number;
  /** SIMD optimizations used */
  simdUsed: boolean;
}

/**
 * FLAC error types
 */
export type FLACError =
  | 'UNKNOWN'
  | 'MEMORY_ALLOCATION_ERROR'
  | 'INVALID_METADATA'
  | 'INVALID_STREAM'
  | 'UNSUPPORTED_FORMAT'
  | 'ENCODER_ERROR'
  | 'DECODER_ERROR'
  | 'IO_ERROR';

/**
 * FLAC callback functions for streaming
 */
export interface FLACCallbacks {
  /** Read callback for decoder input */
  read?: (bytes: number) => Uint8Array | null;
  /** Write callback for encoder output */
  write?: (data: Uint8Array) => boolean;
  /** Seek callback for random access */
  seek?: (offset: number) => boolean;
  /** Tell callback for position */
  tell?: () => number;
  /** EOF callback */
  eof?: () => boolean;
  /** Metadata callback */
  metadata?: (metadata: FLACMetadata) => void;
  /** Error callback */
  error?: (error: FLACError, message: string) => void;
}