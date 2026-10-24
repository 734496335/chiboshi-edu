# Getting started

Chiboshi runs on your own computer. The repository does not provide a maintained public demo.

## Requirements

- Node.js 22 is recommended. The installed Next.js 16 line requires Node.js 20.9 or newer.
- npm and a modern browser.
- An internet connection for dependency installation and optional external model requests. The project is not currently guaranteed to operate fully offline.

## Install and start

Clone or download an authorized copy of the repository, open its directory, and run:

```bash
npm ci
npm run dev
```

Visit [http://127.0.0.1:3000](http://127.0.0.1:3000). The supplied development command binds to the loopback interface for use on your computer. Stop it with `Ctrl+C` in the terminal.

Start by opening a measurement dimension and browsing the reference dictionary. This lets you inspect built-in content without supplying an API key. Many activity labels and reference entries are currently Chinese; the [Learning guide](LEARNING_GUIDE.md) explains the intended exploration sequence in English.

Windows users can also run `dev.bat`. For a local presentation bundle, see [the classroom guide](../classroom/README-classroom.md).

## Optional AI configuration

Copy `.env.local.example` to `.env.local` using your editor or file manager. Set the following values to those supplied by your chosen provider:

| Variable | Meaning |
| --- | --- |
| `LLM_API_KEY` | Provider credential, kept on the server. |
| `LLM_BASE_URL` | API base URL used before `/chat/completions`. |
| `LLM_MODEL` | Model identifier supported by that provider. |

Do not put a secret in a `NEXT_PUBLIC_*` variable. Do not commit `.env.local` or `llm_config.json`.

The client also recognizes legacy `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and `DEEPSEEK_MODEL` variables. A saved local `llm_config.json` takes precedence over environment values for fields it supplies. If changing an environment value has no effect, check whether you previously saved a local setting. Restart the development server after editing `.env.local`.

AI-assisted interpretation requires a working model configuration. The built-in dictionary is separate from those requests. Do not assume an AI-dependent action will work without credentials or that an error fallback is equivalent to model output. Provider availability, billing, and supported request parameters depend on your account and model.

In the local settings dialog, leaving the key blank preserves the existing key. To change the provider base URL while a key is configured, supply the new provider's key explicitly; the application will not silently send the old credential to a different address. The dialog does not provide an implicit key-clear action.

The experimental image workshop has additional requirements. The optional Python worker, local model paths, and image-generation dependencies are described in [the image pipeline notes](../scripts/pixel-bake/README.md); a text-model key alone does not install that backend.

## Validate a change

```bash
npm test
npm run typecheck
npm run build
npm run check:bundle
npm run lint
```

The bundle check inspects the production output for files that must not be distributed. Lint cleanup is tracked separately: a successful build is not evidence that every lint finding has been resolved. Report the actual output when contributing.

To inspect a production build locally:

```bash
npm run start
```

Use the same loopback URL. Do not run the development and production servers on port 3000 at the same time.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Dependency installation fails | Node/npm versions, registry access, and the exact error. Use `npm ci` with the committed lockfile. |
| Port 3000 is already in use | Stop the other application or start with `npm run dev -- --port 3001` and open that port. |
| AI action fails | All three provider variables, local config precedence, provider access, model name, quota, and network connectivity. |
| AI output seems implausible | Treat it as a draft; compare it with a physical measurement or a trusted reference. |
| Icons fail to load | Browser console and network access for dynamically requested icons. Full asset localization remains a roadmap item. |
| Lettering looks different | Display text uses the bundled Maoken font and body text uses system fonts. Check `/fonts/maoken/` requests if the display font fails; operating systems can render fallback text differently. |

## Working with learners

Use invented object descriptions rather than personal details. Optional AI actions send their input to the configured provider. An adult should review prompts and generated measurements before using them in a learning activity. Keep the supplied local-only setup when evaluating the project; authentication, classroom administration, and a managed multi-user service are outside the current scope.
