#!/bin/bash
# Packages a signed The Dailies.app as the website's .dmg, with the themed "drag to Applications"
# window (make-dmg-background.swift) and the app icon as the disk's icon:
#   apple/tools/make-dmg.sh <path to Dailies.app> <out.dmg>
# Finder lays the window out, so the first run may ask to let Terminal control Finder.
set -euo pipefail

app=${1:?usage: $0 <app> <out.dmg>}
dmg=${2:?usage: $0 <app> <out.dmg>}
tools=$(cd "$(dirname "$0")" && pwd)
name="The Dailies"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

stage=$work/stage
mkdir -p "$stage/.background"
ditto "$app" "$stage/$name.app"
ln -s /Applications "$stage/Applications"
swift "$tools/make-dmg-background.swift" "$work" >/dev/null
# one file with both sizes, so Finder draws it sharp on Retina screens
tiffutil -cathidpicheck "$work/background.png" "$work/background@2x.png" -out "$stage/.background/background.tiff" 2>/dev/null
cp "$app/Contents/Resources/AppIcon.icns" "$stage/.VolumeIcon.icns"

# a Finder window can only be styled on a writable image, then it's compressed
hdiutil detach "/Volumes/$name" -quiet 2>/dev/null || true # an earlier copy left open
hdiutil create -quiet -volname "$name" -srcfolder "$stage" -format UDRW -fs HFS+ -ov "$work/rw.dmg"
mount=$(hdiutil attach -readwrite -noverify -noautoopen "$work/rw.dmg" | grep -o "/Volumes/.*" | head -1)
SetFile -a C "$mount" # use .VolumeIcon.icns

# positions are icon centers in points from the window's top-left, matching the background's cards
osascript <<EOF
tell application "Finder"
  tell disk "$name"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set bounds of container window to {200, 120, 840, 548} -- 400 + the title bar
    set opts to icon view options of container window
    set arrangement of opts to not arranged
    set icon size of opts to 96
    set text size of opts to 13
    set background picture of opts to file ".background:background.tiff"
    set position of item "$name.app" of container window to {170, 212}
    set position of item "Applications" of container window to {470, 212}
    update without registering applications
    delay 1
    close
  end tell
end tell
EOF

sync
hdiutil detach "$mount" -quiet
hdiutil convert -quiet "$work/rw.dmg" -format UDZO -imagekey zlib-level=9 -ov -o "$dmg"
