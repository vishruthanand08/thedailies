#!/bin/bash
# The Mac app for the website download: archives, signs with Developer ID, notarizes, staples
# and packages it as a .dmg. Notarizing uses the notarytool login saved once with
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
xcodebuild -project "$apple/Dailies.xcodeproj" -scheme Dailies -destination 'generic/platform=macOS' \
  -archivePath "$archive" -allowProvisioningUpdates archive -quiet

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
echo "Built $dmg"

[ "$publish" = "--publish" ] || exit 0

tag=mac-$version-$build
cp "$dmg" "$out/TheDailies.dmg"
gh release create "$tag" "$out/TheDailies.dmg" --repo "$repo" \
  --title "The Dailies for Mac $version ($build)" --notes "$notes"
node -e '
  const [version, build, url, notes] = process.argv.slice(1)
  const r = { version, build: Number(build), url, notes, minimumSystem: "14.0" }
  require("fs").writeFileSync(process.argv[5], JSON.stringify(r, null, 2) + "\n")
' "$version" "$build" "https://github.com/$repo/releases/download/$tag/TheDailies.dmg" "$notes" \
  "$root/server/mac-release.json"
echo "Published $tag. Commit server/mac-release.json and deploy to offer it."
