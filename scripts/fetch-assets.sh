#!/usr/bin/env bash
# Downloads the CC0 art used by STARNET into public/assets.
# Every source below was checked by hand for a CC0 license; see CREDITS.md.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/assets
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

fetch() { # url dest
  echo "fetch $1"
  curl -fsSL --retry 3 -o "$2" "$1"
}

# 1. Warped Top-Down Tech Lab by ansimuz (CC0)
#    https://opengameart.org/content/warped-top-down-tech-lab
fetch https://opengameart.org/sites/default/files/top_down_lab_files.zip "$TMP/lab.zip"
unzip -qo "$TMP/lab.zip" -d "$TMP/lab"
cp "$TMP/lab/Top Down Lab files/Tileset.png" "$OUT/lab-tileset.png"
cp "$TMP/lab/Top Down Lab files/public-license.txt" "$OUT/lab-tileset.LICENSE.txt"

# 2. 16x16 base sprites (CC0, no attribution required)
#    https://opengameart.org/content/16x16-base-sprites
fetch https://opengameart.org/sites/default/files/base_male.png "$OUT/crew-base-a.png"
fetch https://opengameart.org/sites/default/files/base_female.png "$OUT/crew-base-b.png"

# Sanity check: fail loudly if a source changed shape.
check_size() { # file w h
  local dims
  dims=$(node -e "const b=require('fs').readFileSync(process.argv[1]);console.log(b.readUInt32BE(16)+'x'+b.readUInt32BE(20))" "$1")
  [ "$dims" = "$2x$3" ] || { echo "unexpected size for $1: $dims (want $2x$3)"; exit 1; }
}
check_size "$OUT/lab-tileset.png" 240 176
check_size "$OUT/crew-base-a.png" 126 144
check_size "$OUT/crew-base-b.png" 126 144
echo "assets ok"
