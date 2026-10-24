@AGENTS.md

# Chiboshi technical reference

Chiboshi is a local educational measurement playground built with Next.js 16, React 19, and TypeScript. Read the installed Next.js documentation before changing routes, metadata, or rendering boundaries.

## Navigation

- [Getting started](docs/GETTING_STARTED.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Learning guide](docs/LEARNING_GUIDE.md)
- [Contribution workflow](CONTRIBUTING.md)
- [Security and local operation](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Technical conventions

- `src/lib/dimensions.ts` defines the six educational dimensions. `volume` means liquid capacity in litres; `cubic` means occupied space in cubic metres. Preserve that distinction.
- `src/lib/units.ts` normalizes measurements. Reference values are teaching approximations, not calibrated measurements.
- `src/lib/deepseek.ts` is the existing provider-neutral Chat Completions adapter despite its historical filename. Provider credentials must stay on the server.
- `src/lib/utils.ts` resolves optional base-path URLs. Prefer those helpers over hard-coded deployment URLs.
- Framer Motion provides animation; Rough.js provides hand-drawn graphics. Libraries requiring a DOM must be used from client components.
- Icons can be served from the committed `public/icons/` assets. Preserve their collection identifiers and license notices when rebaking them.
- The optional Python image worker is separate from the Node application and is not required to build the base application.

## Language and claims

The English entry page and documentation describe the project's actual capabilities. Most classroom examples, reference labels, and AI prompts currently remain Simplified Chinese. Do not describe this as a fully localized English application until the teaching routes and responses have been translated and tested.

Use `@734496335` as the verified maintainer handle. Keep third-party and AI-assisted provenance separate from maintenance ownership.
