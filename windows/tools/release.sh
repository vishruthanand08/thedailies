#!/bin/bash
# Builds the Windows installer and publishes it: a GitHub release windows-<version> with the .exe,
# and server/windows-release.json, which the website's download (/download/windows,
# /api/app/windows) reads. Bump "version" in windows/package.json first. Then commit
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
gh release create "$TAG" "$EXE" -R "$REPO" --latest=false \
  --title "The Dailies for Windows $VERSION" --notes "${NOTES:-The Dailies for Windows $VERSION}"

URL="https://github.com/$REPO/releases/download/$TAG/$(basename "$EXE")"
node -e '
const [version, url, notes, length] = process.argv.slice(1)
const r = { version, url, notes, length: Number(length), published: new Date().toISOString() }
require("fs").writeFileSync("../server/windows-release.json", JSON.stringify(r, null, 2) + "\n")
' "$VERSION" "$URL" "$NOTES" "$(stat -f%z "$EXE" 2>/dev/null || stat -c%s "$EXE")"
echo "Published $URL; commit server/windows-release.json and deploy."
