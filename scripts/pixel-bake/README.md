# Optional illustration pipeline

This folder contains the experimental local image-generation backend. It is separate from the Next.js application and is not needed to install, build, or browse the supplied reference assets.

The current `bake.py` uses FLUX.1-schnell. Older code comments and the `pixel` directory name reflect an earlier pixel-art pipeline; the current default style is illustration. Do not assume every generated image is 16×16 pixels.

## Requirements and setup

The included batch launchers target Windows with Miniconda/Anaconda and an NVIDIA CUDA environment. Other platforms need equivalent environment and process setup; cross-platform GPU operation has not been validated here.

1. Inspect `environment.yml`, `requirements.txt`, and `setup.bat` before installing. The setup script creates the `lianggan-pixel` environment and uses the SJTU PyTorch and Aliyun PyPI mirrors inherited from the original development environment.
2. Choose a PyTorch build compatible with your GPU and driver using the [official PyTorch installation guidance](https://pytorch.org/get-started/locally/). The script's older CUDA defaults are not a hardware compatibility guarantee.
3. Obtain the model separately from its [upstream model repository](https://huggingface.co/black-forest-labs/FLUX.1-schnell), subject to its license. Model weights are not included here.
4. Set `BAKE_BASE_MODEL` to your local model directory before starting the worker. Otherwise the implementation checks a legacy Windows model path and may fall back to the upstream model identifier.

For example, in Command Prompt:

```cmd
set BAKE_BASE_MODEL=C:\models\FLUX.1-schnell
```

The batch launcher defaults to offline model loading. For an intentional first download, `set OFFLINE=0` before running it; return to offline mode only after the required files are cached. CPU generation can be impractically slow, and the project does not promise a particular VRAM requirement or generation time.

## Generate a small sample first

From this folder:

```cmd
bake.bat --limit 5
bake.bat --only sesame ant
```

The launcher exports reference data and then invokes `bake.py`. Its `npx tsx` step may need an additional package download. With the environment prepared, `python bake.py --help` describes the available flags.

Existing images are skipped by default. `bake.bat --force` intentionally replaces generated assets; review any changes before committing them. `bake-catalog.bat` handles the broader visual-assets catalogue.

## Inputs and output

| File or directory | Purpose |
| --- | --- |
| `prompts.py` | Reference descriptions and style prompts. |
| `_dump-refs.mts` | Exports application reference data. |
| `visual-assets.json` | Extended asset catalogue. |
| `bake.py` | One-shot generation pipeline. |
| `bake_worker.py` | Persistent JSON-lines worker used by the application. |
| `public/icons/pixel/` | Generated PNGs and the most recent bake manifest. |

The manifest records a generation run; it is not a complete historical provenance inventory. Review images for subject accuracy, unsuitable content, and third-party characters before using them in educational material. Keep the [third-party notices](../../THIRD_PARTY_NOTICES.md) with redistributed assets.
