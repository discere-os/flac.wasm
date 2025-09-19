#!/bin/bash
# build-dual.sh - Dual build system for flac.wasm
#
# Copyright (c) 2001-2025 Josh Coalson & Xiph.Org Foundation
# Copyright (c) 2025 Superstruct Ltd, New Zealand
# Licensed under BSD-3-Clause (Xiph.Org license)

set -euo pipefail

VARIANT="${1:-all}"
BUILD_DIR="${BUILD_DIR:-./build-dual}"
INSTALL_PREFIX="${INSTALL_PREFIX:-./install}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check dependencies
check_prerequisites() {
    log_info "Checking build prerequisites..."

    if ! command -v emcc &> /dev/null; then
        log_error "Emscripten not found. Please install and activate EMSDK."
        exit 1
    fi

    # Check for OGG dependency
    if [ ! -f "../ogg.wasm/install/wasm/ogg-side.wasm" ]; then
        log_warning "Building OGG dependency..."
        cd ../ogg.wasm && ./build-dual.sh side && cd -
    fi

    log_success "Prerequisites check completed"
}

# Build SIDE_MODULE (production with OGG dependency)
build_side_module() {
    log_info "Building flac-side.wasm for production..."
    mkdir -p "${BUILD_DIR}-side"
    cd "${BUILD_DIR}-side"

    # Configure with CMake for SIDE_MODULE
    emcmake cmake .. \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_SIDE_MODULE=ON \
        -DBUILD_SHARED_LIBS=OFF \
        -DBUILD_PROGRAMS=OFF \
        -DBUILD_EXAMPLES=OFF \
        -DBUILD_TESTING=OFF \
        -DBUILD_DOCS=OFF \
        -DWITH_OGG=ON \
        -DOGG_ROOT=../../ogg.wasm/install \
        -DENABLE_MULTITHREADING=OFF \
        -DCMAKE_C_FLAGS="-fPIC -msimd128 -O3 -flto" \
        -DCMAKE_EXE_LINKER_FLAGS="-sSIDE_MODULE=1 -sSTANDALONE_WASM=1"

    emmake make -j$(nproc)

    # Copy SIDE_MODULE output
    mkdir -p "${INSTALL_PREFIX}/wasm"
    find . -name "*.wasm" -exec cp {} "${INSTALL_PREFIX}/wasm/flac-side.wasm" \;

    if [ ! -f "${INSTALL_PREFIX}/wasm/flac-side.wasm" ]; then
        log_error "Failed to find SIDE_MODULE WASM file"
        exit 1
    fi

    log_success "SIDE_MODULE: $(ls -lh ${INSTALL_PREFIX}/wasm/flac-side.wasm | awk '{print $5}')"
    cd ..
}

# Build MAIN_MODULE (testing/NPM with embedded dependencies)
build_main_module() {
    log_info "Building flac-main.js for testing..."
    mkdir -p "${BUILD_DIR}-main"
    cd "${BUILD_DIR}-main"

    # Configure with CMake for MAIN_MODULE
    emcmake cmake .. \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_MAIN_MODULE=ON \
        -DBUILD_SHARED_LIBS=OFF \
        -DBUILD_PROGRAMS=OFF \
        -DBUILD_EXAMPLES=OFF \
        -DBUILD_TESTING=OFF \
        -DBUILD_DOCS=OFF \
        -DWITH_OGG=ON \
        -DOGG_ROOT=../../ogg.wasm/install \
        -DENABLE_MULTITHREADING=OFF \
        -DCMAKE_C_FLAGS="-msimd128 -O3 -flto" \
        -DCMAKE_EXE_LINKER_FLAGS="-sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=FLACModule -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=67108864 -sENVIRONMENT=web,webview,worker -sNODEJS_CATCH_EXIT=0 -sNODEJS_CATCH_REJECTION=0"

    emmake make -j$(nproc)

    # Copy MAIN_MODULE outputs
    mkdir -p "${INSTALL_PREFIX}/wasm"
    find . -name "*.js" -exec cp {} "${INSTALL_PREFIX}/wasm/flac-main.js" \;
    find . -name "*.wasm" -exec cp {} "${INSTALL_PREFIX}/wasm/flac-main.wasm" \;

    if [ ! -f "${INSTALL_PREFIX}/wasm/flac-main.js" ]; then
        log_error "Failed to find MAIN_MODULE JS file"
        exit 1
    fi

    log_success "MAIN_MODULE: $(ls -lh ${INSTALL_PREFIX}/wasm/flac-main.js | awk '{print $5}')"
    cd ..
}

case "$VARIANT" in
    side)
        check_prerequisites && build_side_module
        ;;
    main)
        check_prerequisites && build_main_module
        ;;
    all)
        check_prerequisites && build_side_module && build_main_module
        ;;
    clean)
        rm -rf "${BUILD_DIR}"-* "${INSTALL_PREFIX}"
        log_success "Clean completed"
        ;;
    *)
        echo "Usage: $0 [side|main|all|clean]"
        echo ""
        echo "Build variants:"
        echo "  side - Build SIDE_MODULE for production (links to ogg.wasm)"
        echo "  main - Build MAIN_MODULE for testing (embedded dependencies)"
        echo "  all  - Build both modules"
        echo "  clean - Clean all build artifacts"
        exit 1
        ;;
esac