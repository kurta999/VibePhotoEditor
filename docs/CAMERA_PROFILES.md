# Camera-inspired profiles

These 15 profiles are original aesthetic choices for this editor. They apply tone, color, and texture adjustments to an already captured image. Descriptions below explain the **effect we designed**, not a verified characteristic of the named camera. No actual camera color samples, manufacturer LUTs, calibration measurements, or sensor/lens models were used.

| Inspiration | Designed effect |
| --- | --- |
| Canon EOS R5 Mark II | Warm color, gentle highlights, crisp detail |
| Canon EOS R3 | Warm midtones, softer texture, open shadows |
| Canon EOS R1 | Bold contrast, lively color, deeper shadows |
| Nikon Z9 | Cooler color, rich contrast, pronounced texture |
| Nikon Z8 | Bright color, open shadows, light haze removal |
| Nikon D850 | Deeper blacks, classic warm color, crisp texture |
| Sony α1 II | Balanced light, neutral color, clear edges |
| Sony α9 III | Brighter exposure, lively contrast and color |
| Sony α7R V | Restrained color, stronger clarity and sharpening |
| Fujifilm GFX100 II | Softer contrast, controlled highlights, rich color |
| Fujifilm GFX100S II | Mellow contrast, warm color, gentle glow |
| Hasselblad X2D 100C | Luminous midtones, soft highlights, quiet color |
| Leica SL3 | Rich blacks, restrained saturation, local contrast |
| Leica M11 | Warm midtones, deep edges, a little grain |
| Leica Q3 | Crisp texture, warm color, subtle vignette |

The numeric definitions are in `cameras.js`. Camera and creative-look strengths are independent. The engine adds both profiles' parameters and manual offsets, then clamps to each slider's bounds. Set camera strength to zero to remove its effect while keeping the selection. The **Remove camera simulation** button clears the selection. Reset clears camera, look, and all adjustments; undo restores the previous state.

Camera profiles affect preview and actual PNG/JPG exports. They do not change image resolution, recreate depth of field, remove physical motion blur, synthesize missing detail, or provide extra sensor dynamic range. Optical background blur remains the separate center-focused softness control.

## Manufacturer references

Used to verify the model names and camera families, not to derive the aesthetic parameters:

- [Canon EOS R system](https://www.usa.canon.com/digital-cameras/eos-r-system)
- [Nikon Z9](https://www.nikonusa.com/p/z-9/1669/overview), [Nikon Z8 and comparison models](https://www.nikonusa.com/p/z-8/1698/overview)
- [Sony interchangeable-lens camera lineup](https://electronics.sony.com/imaging/interchangeable-lens-cameras/c/all-interchangeable-lens-cameras)
- [Fujifilm camera compatibility lineup](https://www.fujifilm-x.com/en-ca/support/compatibility/cameras/)
- [Hasselblad X2D 100C](https://www.hasselblad.com/x-system/x2d-100c/)
- [Leica system cameras](https://leica-camera.com/en-int/photography/cameras/system-cameras)

Camera names and trademarks belong to their owners. This editor and these profiles are not affiliated with or endorsed by those manufacturers. Prices are not used: they depend on date, region, retailer, configuration, and whether a lens is included.
