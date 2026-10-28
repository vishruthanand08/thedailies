#!/bin/bash
# The Mac app for the website download (the DailiesDirect target, with Sparkle): archives, signs
# with Developer ID, notarizes, staples and packages it as a .dmg, then signs the .dmg for Sparkle
# with the private key in this Mac's keychain (made once by Sparkle's generate_keys; back it up
# with `generate_keys -x <file>`, since copies already out there only accept updates signed by it).
# The App Store build is the Dailies target, archived on its own (appstore/README.md). Notarizing uses the notarytool login saved once with
#   xcrun notarytool store-credentials dailies-notary --apple-id <apple id> --team-id <team id>
# With --publish it also uploads the .dmg to a GitHub release and points server/mac-release.json
# at it; commit that file and deploy, and copies of the app already out there offer the update
# (MacUpdates.swift).
#
#   DAILIES_TEAM=<team id> apple/tools/release-mac.sh "What's new in this build" [--publish]
#
# Bump CURRENT_PROJECT_VERSION in apple/project.yml first: the app only offers a higher build.
set -euo pipefail

notes=${1:?"usage: DAILIES_TEAM=<team id> $0 \"What's new\" [--publish]"}
publish=${2:-}
: "${DAILIES_TEAM:?export DAILIES_TEAM=<team id> first}"
repo=vishruthanand08/thedailies
profile=${DAILIES_NOTARY:-dailies-notary}

root=$(cd "$(dirname "$0")/../.." && pwd)
apple=$root/apple
out=$apple/build/release
version=$(sed -nE 's/^ *MARKETING_VERSION: "?([^" ]+)"?.*/\1/p' "$apple/project.yml")
build=$(sed -nE 's/^ *CURRENT_PROJECT_VERSION: "?([0-9]+)"?.*/\1/p' "$apple/project.yml")
archive=$out/Dailies-$version-$build.xcarchive
dmg=$out/TheDailies-$version-$build.dmg
echo "The Dailies for Mac $version ($build)"

rm -rf "$out" && mkdir -p "$out"
(cd "$apple" && DAILIES_PUSH=-Push xcodegen generate >/dev/null)

echo "Archiving…"
# a fresh build cache each release: a reused one can trip Xcode copying Sparkle's framework
# signature into the archive ("already exists")
derived=$out/DerivedData
xcodebuild -project "$apple/Dailies.xcodeproj" -scheme DailiesDirect -destination 'generic/platform=macOS' \
  -derivedDataPath "$derived" -archivePath "$archive" -allowProvisioningUpdates archive -quiet

plist() {
  cat > "$out/export-$1.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>developer-id</string>
<key>destination</key><string>$1</string>
<key>signingStyle</key><string>automatic</string>
</dict></plist>
EOF
}

echo "Signing with Developer ID…"
plist export
xcodebuild -exportArchive -archivePath "$archive" -exportPath "$out/signed" \
  -exportOptionsPlist "$out/export-export.plist" -allowProvisioningUpdates -quiet
app=$out/signed/Dailies.app

echo "Notarizing (Apple usually takes a few minutes)…"
ditto -c -k --keepParent "$app" "$out/Dailies.zip"
xcrun notarytool submit "$out/Dailies.zip" --keychain-profile "$profile" --wait
xcrun stapler staple "$app"
spctl --assess --type execute "$app"

echo "Packaging…"
"$apple/tools/make-dmg.sh" "$app" "$dmg"
# the disk image gets its own ticket too, so it opens cleanly offline
xcrun notarytool submit "$dmg" --keychain-profile "$profile" --wait
xcrun stapler staple "$dmg"

# Sparkle checks this before installing an update (after stapling, which changes the file)
sign_update=$(find "$derived/SourcePackages/artifacts" -name sign_update -type f -perm -u+x | head -1)
[ -n "$sign_update" ] || { echo "Sparkle's sign_update wasn't found under $derived" >&2; exit 1; }
sparkle=$("$sign_update" "$dmg") # sparkle:edSignature="…" length="…"
signature=$(sed -nE 's/.*edSignature="([^"]+)".*/\1/p' <<<"$sparkle")
length=$(sed -nE 's/.*length="([0-9]+)".*/\1/p' <<<"$sparkle")
[ -n "$signature" ] && [ -n "$length" ] || { echo "Couldn't sign the .dmg for Sparkle" >&2; exit 1; }
echo "Built $dmg (signed for Sparkle)"

[ "$publish" = "--publish" ] || exit 0

tag=mac-$version-$build
cp "$dmg" "$out/TheDailies.dmg"
gh release create "$tag" "$out/TheDailies.dmg" --repo "$repo" \
  --title "The Dailies for Mac $version ($build)" --notes "$notes"
node -e '
  const [version, build, url, notes, edSignature, length, out] = process.argv.slice(1)
  const r = { version, build: Number(build), url, notes, minimumSystem: "14.0",
              edSignature, length: Number(length), published: new Date().toISOString() }
  require("fs").writeFileSync(out, JSON.stringify(r, null, 2) + "\n")
' "$version" "$build" "https://github.com/$repo/releases/download/$tag/TheDailies.dmg" "$notes" \
  "$signature" "$length" "$root/server/mac-release.json"
echo "Published $tag. Commit server/mac-release.json and deploy to offer it."
