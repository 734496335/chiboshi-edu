# Chiboshi media kit

![Chiboshi: Make measurement make sense](cover.png)

A small set of real demonstrations for educators, learners, and open-source contributors. The visual style follows the application: warm cream, dark brown, restrained orange and teal, and the existing Dr. Measure owl.

## Watch

The full **47-second walkthrough** and a focused **16-second unit-change clip** are attached to the media update pull request and linked from the project README. Videos use H.264 at 1600 × 900, 25 fps, with English explanations built into the frames. Both are silent and suitable for watching without sound.

The recordings use the real Chinese classroom interface and the local deterministic comparison fallback. No provider credentials or mocked responses were used.

[Written transcript and teaching prompts](transcript.md) · [WebVTT captions](walkthrough.en.vtt) · [SRT captions](walkthrough.en.srt)

## Quick preview

![A real comparison changes from a five-metre ant to a five-millimetre ant](preview.gif)

## Teaching scenes

| Reference and estimate | Revision and transfer |
| --- | --- |
| [![Length reference dictionary with English teaching annotation](01-reference.png)](01-reference.png) | [![The revised five-millimetre input and its actual comparison](03-revised.png)](03-revised.png) |
| Find a familiar scale before estimating. | Change the unit and explain the thousandfold difference. |
| [![A deliberately implausible five-metre ant compared with a car and bus](02-estimate.png)](02-estimate.png) | [![Capacity examples around one litre](04-capacity.png)](04-capacity.png) |
| Ask whether the estimate makes sense. | Transfer the comparison habit to another quantity. |

## Reproduce the capture

Use an already installed Chrome browser, Node.js, Python, and a clean local checkout. Keep provider credentials absent for this specific demonstration. The capture script stops if it finds a configured key.

Start the application in one terminal:

```bash
npm ci
npm run build
npm run start
```

In a second terminal:

```bash
npm exec --yes --package=playwright -- playwright install ffmpeg
npm exec --yes --package=playwright -- node scripts/media/capture.mjs
python -m pip install imageio-ffmpeg
python scripts/media/render.py
```

The capture defaults to `http://127.0.0.1:3000`; set `MEDIA_BASE_URL` for another local port. The optional media tools do not change the application's package dependencies. Rendering writes raw recordings and MP4s under the ignored `.local/media-20261024/` directory, and distributable images, captions, and metadata under `docs/media/`.

The script records real navigation, clicks, input changes, and responses. It also creates clearly separate editorial frames and a pointer highlight. It checks both unit conversions and captures response provenance. Inspect the result before publishing a new recording; interface changes can require selector or caption changes.

## Asset and publishing notes

- `cover.png`: 1280 × 640, suitable for the repository's social preview setting. Adding the file alone does not apply that setting.
- `preview.gif`: 12-second loop for an immediate view of the interaction.
- `01-reference.png` through `04-capacity.png`: actual screenshots with separate English annotations.
- `video-poster.png`: a static poster for links and motion-reduced contexts.
- `capture-metadata.json`: source commit, recording date, actual response values, video properties, and file digests.
- The MP4s are hosted as GitHub attachments to keep video binaries out of Git history.
- Do not describe these images as classroom photographs or evidence of adoption.

The editorial frames and scripts are project material under the root license. Depicted application artwork, fonts, and icons retain the terms in [Third-party notices](../../THIRD_PARTY_NOTICES.md). No stock footage, external music, or synthetic application interface was added.
