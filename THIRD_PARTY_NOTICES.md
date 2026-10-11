# Third-party components

`vendor/heic-to.js` is an unmodified copy of the worker-capable ESM distribution from **heic-to 1.6.5**, authored by Hopper Gee, published to npm under the LGPL-3.0 license.

- Versioned corresponding source package: https://registry.npmjs.org/heic-to/-/heic-to-1.6.5.tgz (includes source files and the libheif build).
- Project repository: https://github.com/hoppergee/heic-to
- Distributed license notice: `vendor/heic-to.LICENSE.txt`.
- License terms: https://www.gnu.org/licenses/lgpl-3.0.html and https://www.gnu.org/licenses/gpl-3.0.html.
- The decoder includes libheif and its codec dependencies; upstream sources and build instructions are linked in the heic-to README and repository. The vendored file is kept separate and can be replaced by the user.

The sample mountain photo was supplied by the user for this project. The application's remaining interface, source files, and styling were created for this project.

## HEIF export encoder

`vendor/elheif-wasm.js` is an unmodified copy of **elheif 0.1.0** by hpp2334, distributed under the MIT license (`vendor/elheif.LICENSE.txt`). The application uses its initialization hook directly to avoid the package wrapper's extensionless import.

- Corresponding versioned package: https://registry.npmjs.org/elheif/-/elheif-0.1.0.tgz
- Wrapper source and complete build instructions: https://github.com/hpp2334/elheif
- The embedded libraries are libheif and libde265 (LGPL-3.0) and kvazaar (BSD-3-Clause). Corresponding upstream sources: https://github.com/strukturag/libheif, https://github.com/strukturag/libde265, https://github.com/ultravideo/kvazaar. The elheif repository records the dependency revisions and build configuration.
- See the bundled `vendor/libheif.COPYING.txt`, `vendor/libde265.COPYING.txt`, and `vendor/kvazaar.LICENSE.txt` notices. The encoder remains a separate, replaceable library and is loaded only for HEIF export.
- To refresh the encoder, install the pinned dependency with scripts disabled and copy `node_modules/elheif/pkg/elheif-wasm.js` and its LICENSE into vendor; rerun the HEIF round-trip tests and browser export check.
