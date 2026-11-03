#!/bin/bash
# Builds the Windows installer and publishes it: a GitHub release windows-<version> with the .exe
# (and its .blockmap, for smaller updates), and server/windows-release.json, which the website's
# download (/download/windows, /api/app/windows) and the apps' update feed
# (/windows-update/latest.yml) read; installed copies update once it's deployed. Bump "version" in windows/package.json first. Then commit
# server/windows-release.json and deploy.
#   windows/tools/release.sh "What's new"
set -euo pipefail
cd "$(dirname "$0")/.."
NOTES="${1:-}"
REPO=vishruthanand08/thedailies
VERSION=$(node -p "require('./package.json').version")
TAG="windows-$VERSION"
EXE="dist/TheDailies-Setup-$VERSION.exe"

npm run dist
[ -f "$EXE" ] || { echo "no $EXE" >&2; exit 1; }

# --latest=false: the Mac release stays GitHub's "Latest"
gh release create "$TAG" "$EXE" "$EXE.blockmap" -R "$REPO" --latest=false \
  --title "The Dailies for Windows $VERSION" --notes "${NOTES:-The Dailies for Windows $VERSION}"

URL="https://github.com/$REPO/releases/download/$TAG/$(basename "$EXE")"
node -e '
const fs = require("fs")
const [version, url, notes, exe] = process.argv.slice(1)
const data = fs.readFileSync(exe)
const sha512 = require("crypto").createHash("sha512").update(data).digest("base64")
const r = { version, url, notes, length: data.length, sha512, published: new Date().toISOString() }
fs.writeFileSync("../server/windows-release.json", JSON.stringify(r, null, 2) + "\n")
' "$VERSION" "$URL" "$NOTES" "$EXE"
echo "Published $URL; commit server/windows-release.json and deploy."
