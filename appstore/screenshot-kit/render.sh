#!/bin/bash
# Renders the pages make-listing.mjs wrote into PNGs at their exact sizes (headless Chrome).
#   appstore/screenshot-kit/render.sh <scratch dir>
set -euo pipefail
dir="$1"; chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p "$dir/png/iphone"
shot() { # page, output, width, height
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --allow-file-access-from-files \
    --virtual-time-budget=6000 --window-size="$3,$4" --screenshot="$2" "file://$1" >/dev/null 2>&1
  # App Store Connect refuses images with an alpha channel
  sips -s format png -s formatOptions default "$2" --out "$2" >/dev/null
  python3 - "$2" <<'PY'
import sys, subprocess
subprocess.run(['sips', '-s', 'hasAlpha', 'no', sys.argv[1]], capture_output=True)
PY
}
for f in "$dir"/pages/iphone/*.html; do shot "$f" "$dir/png/iphone/$(basename "${f%.html}").png" 1320 2868; done
shot "$dir/pages/header.html" "$dir/png/header.png" 3840 1646
shot "$dir/pages/search.html" "$dir/png/search.png" 3840 2560
ls -la "$dir/png" "$dir/png/iphone"
