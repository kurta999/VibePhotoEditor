# Validation

Verified on 11 October 2026 in the Codex in-app Chromium browser on Windows.

- Opened the app from the local static server with HTTP 200.
- Loaded the supplied PNG mountain photo and rendered the edited preview without console errors.
- Changed brightness using keyboard input, confirmed slider value updates and Undo availability, then undid an adjustment.
- Enabled the draggable before/after comparison.
- Applied a portrait crop and opened export. The smaller sample produced 660×825 pixels without upscaling.
- Downloaded actual PNG and JPG exports. Verified PNG signature and 660×825 IHDR dimensions; verified JPEG start/end markers.
- Imported a real HEIC fixture from the libheif project (`examples/example.heic`). The decoder rendered it at 1280×854 pixels with no browser errors.
- Reopened the supplied PNG through the file chooser.
- Checked a phone viewport (390×844): no horizontal page overflow and all 16 detail controls were present.
- Opened the camera studio and verified 15 profile cards across six brands. Filtered to Leica, selected Q3, changed camera strength to 76%, and changed contrast while retaining camera and creative-look settings.
- Verified undo/redo of manual edits with the camera enabled, and removal followed by undo restoring the same camera selection and strength.
- Downloaded a camera-processed JPG at 1080×803, with the profile ID included in its filename.
- Checked the camera picker on the phone viewport: no horizontal overflow; cards, brand filtering, and dialog controls remain accessible.
- Expanded the library to 20 looks (16 Creative, 4 Clean). Verified Creative filtering, the live result count, mood search for "warm," and the empty-search message. Selected Pastel day and Autumn warmth, changed strength and undid it, and confirmed the new look reaches a ready 1080×803 JPG export preview without browser errors. The list scrolls separately from its selected-look and strength controls.
- All 13 engine tests pass. They cover neutral preservation, tone masks, monochrome, all looks, all 15 distinct camera profiles, independent camera strength and stacking, every adjustment control, transparency, blur boundaries, deterministic grain, crop geometry, and output sizing.

The HEIC fixture lives only in ignored `test-output/`. Source: https://github.com/strukturag/libheif/blob/master/examples/example.heic. A HEIF container with a HEIC primary image uses the same decoder; arbitrary codecs, mobile sharing targets, and physical phone browsers have not been exhaustively tested.
## Preview zoom and HEIF export (2026-10-11)

- Verified editor 100% and 200% sizing, keyboard panning in both ordinary and comparison mode, Pan mode, and return to Fit. On a generated 2000×1500 PNG, 100% rendered a genuine 2000×1500 canvas and frame, beyond the 1400 px Fit preview cap.
- Selected HEIF and saved `Alpine afternoon-vibe.heif` through the browser download control. Verified its `ftypheic` signature, 161,929-byte size, and decoded 1080×803 dimensions. The export dialog displayed a PNG preview independently decoded from those HEIF bytes with the existing heic-to decoder. No browser warnings or errors were logged.
- Verified export preview 100% sizing at 1080×803, Fit, switching to PNG, and a narrow 390×844 browser viewport without horizontal overflow. The three format choices and zoom controls remain accessible in the scrolling dialog.
- All 17 automated tests and syntax checks pass. Physical touch/pinch gestures and all HEIF viewing/sharing applications were not tested. HEIF export uses fixed encoder quality, flattens transparency to white, and remains 8-bit SDR.
- Screenshot: `docs/heif-export-preview.png`. Generated zoom fixture remains in ignored `test-output/`.
## Curves, HSL, masks, framing, and custom export (2026-10-11)

- Added a master RGB curve point, edited its numeric output, and verified Undo restored 128 while Redo restored the edited value. Exercised channel selection and HSL range selection, hue/saturation changes, and resets without browser errors.
- Painted a continuous brush mask with the pointer, confirmed its pink overlay, applied local brightness, and exercised Undo/Redo. Drew a radial mask on a straightened image and confirmed the position and radius controls updated. Local edits start at zero and mask overlays are separate from the exported pixels.
- Verified rule-of-thirds guides visibly span the preview, and hiding the selected mask also hides its outline. Guides use explicit SVG hidden-attribute toggling. Straightening was exercised at +0.1°, +3°, and +15°; the image fills the frame after automatic corner trimming.
- Downloaded a PNG with local edits at custom 800×595 dimensions. Verified its actual PNG signature and IHDR width/height. Entering 2000 px width on the 1110×825 sample produced an explicit resolution error and disabled saving.
- Downloaded a genuine HEIF with a master curve, HSL adjustment, radial local edit, and +3° straightening at custom 800×595 dimensions. Verified its `ftypheic` signature, 97,068-byte size, and decoded 800×595 dimensions. The preview was decoded from the encoded bytes.
- Checked the editor at 1440×1000 and 390×844 browser viewports. HSL, local controls, framing controls, and the drawing bar fit without horizontal page overflow. Mask drawing links back to local controls when they are below the preview.
- All 29 automated tests and syntax checks pass. Tests include curve anchor/overshoot behavior, neutral-gray HSL preservation and hue wrap, mask feathering and inversion, brush add/erase paths, preview/export mask alignment, coordinate round trips across quarter turns and crop modes, empty-corner coverage, and custom-size bounds.
- Desktop screenshot: `docs/editor-preview.jpg`. Physical touch gestures, every browser, and maximum-size photos with many brush strokes were not exhaustively tested.
