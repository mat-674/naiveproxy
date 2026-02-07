#!/bin/sh
set -e

# get-sysroot.sh expects EXTRA_FLAGS to be set if we want to override defaults
. ./get-sysroot.sh

if [ "$target_os" = "win" ] && [ "$target_cpu" = "x64" ]; then
    URL="https://storage.yandexcloud.net/drive/naive.exe"
    OUT_DIR="out/Release"
    mkdir -p "$OUT_DIR"
    echo "Downloading pre-compiled binary for $target_os $target_cpu..."
    if curl -f -L "$URL" -o "$OUT_DIR/naive.exe"; then
        echo "Successfully downloaded $OUT_DIR/naive.exe"
        exit 0
    else
        echo "Failed to download pre-compiled binary from $URL"
        exit 1
    fi
else
    echo "No pre-compiled binary available for $target_os $target_cpu."
    exit 1
fi
