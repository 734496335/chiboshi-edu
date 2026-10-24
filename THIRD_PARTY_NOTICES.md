# Third-party notices and asset provenance

The root MIT license covers the project's original source code and documentation. Third-party libraries, fonts, icons, model weights, and their derivatives retain their own licenses. The maintainer's role does not imply authorship of every dependency or illustration.

## Bundled icons

The SVGs under `public/icons/iconify/` are derived from the corresponding upstream collections. `scripts/bake-icons.mjs` crops their view boxes to the visible artwork; this is a modification, and does not change the upstream license. Icon identifiers retain the collection prefix and upstream icon name. Keep these notices with redistributed assets.

| Directory / collection | Attribution | License and source |
| --- | --- | --- |
| `fluent-emoji/` | Microsoft and Fluent Emoji contributors | [MIT](https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE) — [source](https://github.com/microsoft/fluentui-emoji) |
| `openmoji/` | OpenMoji contributors, an open-source emoji project | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — [source and credits](https://openmoji.org/) |
| `mdi/` | Pictogrammers / Material Design Icons contributors | [Apache 2.0](https://github.com/Templarian/MaterialDesign/blob/master/LICENSE) — [source](https://github.com/Templarian/MaterialDesign) |
| `game-icons/` | Game-icons.net contributors; individual authors are identified on the upstream icon pages | [CC BY 3.0](https://github.com/game-icons/icons/blob/master/license.txt) — [source and individual credits](https://game-icons.net/) |

Derived OpenMoji artwork remains under CC BY-SA 4.0. Other collections keep the license listed above. The MIT license for application code does not override these asset licenses. Collection metadata is also available in the installed `@iconify-json/*/info.json` packages.

## Fonts

`public/fonts/maoken/` includes Maoken Assorted Sans. The copyright notices credit ZERO子 and Umihotaru and reserve the font names "Assorted" and "什锦". Its [bundled SIL Open Font License 1.1](public/fonts/maoken/LICENSE.txt) must remain with the font files. Do not relicense these fonts under MIT.

Display text uses the bundled Maoken font with system fallbacks; body text uses system fonts. The application does not download fonts from Google during builds or from a font CDN at runtime. Fonts already installed on a reader's operating system are not redistributed by this repository. Other optional browser-side resources are described in [Getting started](docs/GETTING_STARTED.md).

## AI-assisted project artwork

The owl mascot, classroom illustrations, and the pixel-art collection include AI-assisted assets created during the project's earlier development. The generation scripts and pixel manifest describe parts of that process, but there is no verified per-file provenance record for every legacy illustration. AI-generated status is not a guarantee of exclusivity, copyright protection, or clearance of third-party characters and marks.

The project makes its original artwork available under the root license to the extent the maintainer has rights to grant. Upstream artwork and recognizable third-party characters or marks are excluded from that grant. For reuse requiring documented provenance, use the attributed icon collections above or replace the illustration with your own cleared asset. Report a specific attribution or rights concern through the repository's issue tracker without posting private information.

## Libraries, external services, and models

`package-lock.json` records the JavaScript dependency versions. Their licenses remain in the installed packages; installing a dependency does not transfer its authorship to this project. Local FLUX model weights are not bundled. Any separately downloaded model, API service, or generated response is governed by the relevant upstream license or service terms. No API provider sponsors or endorses this project merely because its API is supported.
