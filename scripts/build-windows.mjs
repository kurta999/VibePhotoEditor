import { build, Platform, Arch } from 'electron-builder';
// Moderate compression avoids the much larger memory/time cost of level 9.
// An explicit environment value still allows a different compression level.
process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL ||= '5';
await build({ targets: Platform.WINDOWS.createTarget('portable', Arch.x64), publish: 'never' });
