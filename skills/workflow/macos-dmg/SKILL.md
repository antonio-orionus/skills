---
name: macos-dmg
description: "macOS .dmg installers: building one (dmgbuild, Finder window: background, icon positions, Applications link), keeping it legible under any viewer's Finder settings and light/dark mode, and signing, notarizing and stapling it to pass Gatekeeper."
---

# macOS DMG installer

Done means a `.dmg` that opens to a window showing the app, a link to Applications
and a cue to drag one onto the other, legible for **every viewer**, and that passes
Gatekeeper when downloaded. Choose the tools and layout; the facts below are what
bites, and the checks at the end are the bar.

## Window layout

The layout is rendered by the viewer's Finder, with their settings and appearance,
not yours:

- **Label colour isn't yours.** With a background picture, Finder draws the icon
  labels itself, black in both light and dark appearance on recent macOS (the colour
  has varied between versions). Keep the ground under the labels pale, 4.5:1 or
  better against black, and check on the target macOS in both appearances.
- **Bottom bars eat space.** A viewer's path bar or status bar is a global Finder
  setting that wins over the image's per-window setting, and covers the bottom of the
  window. Keep icons, arrow and text out of the bottom ~60 pt.
- **Hidden files show up** for viewers who show hidden files: the background image
  and `.VolumeIcon.icns` appear as icons (`.DS_Store` never does). Left unpositioned,
  as most installers leave them, Finder puts them just below the icons, half in view,
  and scrolling runs past the background into white. Instead, park them just below
  the visible window, within its width (dmgbuild `icon_locations` accepts them), and
  make the background taller than the window so the ground continues under them:
  those viewers get a vertical scrollbar but a clean window.
- **".app" shows** for viewers who show all filename extensions, whatever the image
  says; leave room for the longer label. dmgbuild's `hide_extension` has been
  reported to add `com.apple.FinderInfo` to the bundle and break
  `codesign --verify --strict`
  ([Dimmerly #104](https://github.com/olujicz/Dimmerly/pull/104)); the checks below
  catch it.

And for every viewer:

- **`window_rect` is the outer frame.** In dmgbuild it includes the title bar (~28 pt
  on recent macOS; check on the target): make the window that much taller than the
  background, or its bottom gets cut.
- **Coordinates** in `icon_locations` are icon centres, in points from the top-left
  of the window's content area.
- **Retina**: ship the background at 1× and 2× (one TIFF from
  `tiffutil -cathidpicheck bg.png bg@2x.png -out bg.tiff`, or a PNG pair).

## Building and signing

- **dmgbuild** writes the window layout (`.DS_Store`) directly. `create-dmg` drives
  Finder through AppleScript instead: it opens windows on the user's screen, needs
  Automation permission and fails without a logged-in desktop.
- **ULMO** (LZMA, macOS 10.15+) gives smaller images than UDZO.
- **Order**: sign the app (Developer ID Application, hardened runtime,
  `--timestamp`), notarize and staple it, build the image from the stapled app, then
  sign the image with the same Developer ID *Application* identity (the *Installer*
  identity is only for `.pkg`) and `--timestamp`, notarize and staple it. The app's
  own ticket lets a copy dragged to Applications open offline; notarizing only the
  image also passes Gatekeeper, online.
- **Zips** for `notarytool` (or for download): `ditto -c -k --norsrc --noextattr
  --keepParent`. Plain `ditto -c -k` stores extended attributes as `._` files, which
  other unzip tools unpack inside the bundle and so break its signature.
- **notarytool** sometimes fails with -1009 "The Internet connection appears to be
  offline" on a working connection: retry the same submission. The build is fine.

## Done when

- Mounted read-only, the volume holds only the app, the Applications link and the
  layout files.
- The app passes `codesign --verify --deep --strict` inside the image and after
  being copied out, and `syspolicy_check distribution <app>` passes on that copy.
- `xcrun stapler validate` passes for the app and the image, and
  `spctl --assess --type open --context context:primary-signature -vv <dmg>` reports
  `source=Notarized Developer ID`.
- Someone has looked at the window in light and dark appearance, and with hidden
  files, all filename extensions and the path and status bars turned on, and with
  hidden files shown, scrolled to the bottom. Change
  those settings only in a throwaway macOS VM, never on the user's own Mac: they are
  global Finder settings, and `killall Finder` closes their windows.
  (`defaults write com.apple.finder AppleShowAllFiles -bool true`,
  `… ShowPathbar -bool true`, `… ShowStatusBar -bool true`,
  `defaults write NSGlobalDomain AppleShowAllExtensions -bool true`, then
  `killall Finder`.) Or ask the user to look.
