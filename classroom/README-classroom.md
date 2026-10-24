# Local classroom bundle

This optional workflow runs a built copy on an instructor's Windows computer. It does not publish the application to a cloud service. The classroom activities currently use Simplified Chinese; the repository documentation and entry page are English-first.

## Build on the development computer

Use a supported Node.js version (22 LTS is recommended), then run:

```sh
npm ci
npm run build
```

The project uses Next.js standalone output. Copy these components into a new local folder:

| Source | Destination |
| --- | --- |
| Contents of `.next/standalone/` | Bundle root |
| `public/` | `public/` |
| `.next/static/` | `.next/static/` |
| `classroom/start.bat` | `start.bat` |
| This document | `README-classroom.md` |

Place a compatible Windows `node.exe` in the bundle root, or install Node.js on the presentation computer. Obtain Node.js from [nodejs.org](https://nodejs.org/). Do not include your development `.env.local`, repository history, or personal files in a shared bundle.

## Run

Double-click `start.bat`. It binds the standalone server to `127.0.0.1` and opens `http://localhost:3000`. Closing the terminal stops the application.

The supplied icons and built-in references can be explored without an AI key. AI interpretation, conversation, and content generation may require network access, an instructor-owned provider key, or a separately configured local model. This bundle is not a promise of fully offline operation. The Next.js build may download fonts, and some browser resources use external services.

To configure optional AI features, use the local settings dialog, or provide `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL` in the bundle's private `.env` file. Never distribute a bundle containing a real key. The launcher also accepts `PORT` from that file.

## Limits

The local image-generation worker requires a separate Python and model setup; it is not part of the portable Node.js bundle. The application has no multi-user authentication or classroom account-management system. Use it as an instructor-operated local demonstration and review generated facts before presenting them.
