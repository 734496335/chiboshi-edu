# Architecture

Chiboshi is a Next.js App Router application. React components handle the interactive interface, built-in TypeScript data supplies reference examples, and server routes support optional AI features. The application is intended for local exploration.

## Main modules

| Location | Responsibility |
| --- | --- |
| `src/app/page.tsx` | Main entry page and activity navigation. |
| `src/app/play/[dimension]/` | Measurement activities organized by dimension, including sandbox and dictionary routes. |
| `src/app/dev/icons/` | Creative workshop and visual-asset experimentation. |
| `src/app/api/` | Server-side endpoints for model-backed and configuration-related operations. |
| `src/components/VisualCompare.tsx` | Visual comparison and relative-scale rendering. |
| `src/components/FooterSettings.tsx` | Local model-settings interface. |
| `src/components/Mascot.tsx` | Mascot presentation. |
| `src/lib/dimensions.ts` | Dimension labels, routes, and availability. |
| `src/lib/units.ts` | Conversion factors and display formatting. |
| `src/lib/dictionary.ts` | Built-in measurement dictionary. |
| `src/lib/references.ts` | Reference objects and their measurement data. |
| `src/lib/deepseek.ts` | Server-side chat-completion client; the filename is historical. |

## Measurement flow

A user selects a dimension and supplies or chooses a measurement. The activity combines the quantity, unit, and reference information to build a visual comparison. The dictionary provides an alternative path for exploring built-in examples. These data and rendering responsibilities are separate from the optional model provider.

The internal identifier `volume` represents liquid capacity normalized to litres. `cubic` represents occupied space normalized to cubic metres. Preserve this distinction when translating labels or extending unit mappings.

Relative graphics are learning aids. Screen dimensions, layout limits, and a reference object's approximation can affect what is displayed. The screen is not a calibrated physical ruler.

## Optional model requests

Model-dependent actions reach a server route, which calls the shared client. The client builds a request to a provider's `/chat/completions` endpoint with the chosen model, messages, and optional JSON response mode. It applies a timeout and reports missing configuration, HTTP errors, empty responses, and parsing failures.

`chatJSON` parses model text into JSON, including limited recovery for common formatting wrappers. Parsing JSON alone does not prove that the content is correct or suitable for children. Calling routes and maintainers remain responsible for validating and presenting generated content.

Provider credentials belong in server-side environment values or the ignored local settings file. See [Getting started](GETTING_STARTED.md) for configuration precedence. A compatible protocol does not guarantee identical model behavior or support for every parameter.

The optional image-generation pipeline uses a separate Python worker and separately obtained model files. It is not included in the basic Node.js runtime.

## Language and assets

English project documentation and entry-page text coexist with Chinese activity text, reference data, and prompts. Translation work must cover full interactions and preserve stable identifiers. Asset provenance is separate from application logic: consult [Third-party notices](../THIRD_PARTY_NOTICES.md) before adding or redistributing material.

## Operational boundary

The project provides a local application, not a managed classroom service. A public multi-user deployment would need its own authentication, access controls, provider-cost controls, privacy design, and operational review. The former hosted deployment is not part of the supported workflow.

Production output is checked with `npm run check:bundle` to help keep private local files and historical deployment material out of distributable artifacts. This check is a packaging safeguard, not a claim of a complete security audit.
