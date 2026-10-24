# Contributing to Chiboshi

Contributions that make measurement concepts easier to explore and the code easier to understand are welcome. Read the [Getting started guide](docs/GETTING_STARTED.md) before changing the application.

## Useful contributions

- Correct a measurement, conversion, or misleading comparison.
- Improve an explanation, activity, or reference entry.
- Translate a complete interaction, including errors and accessible labels.
- Improve keyboard access, readability, or motion behavior.
- Fix a reproducible defect or a specific inherited lint finding.

For a substantial change, describe the problem and proposed outcome in an issue first. A small, focused change is easier to review.

## Development workflow

1. Start from the current default branch and create a branch for your change.
2. Install dependencies with `npm ci` and run the app with `npm run dev`.
3. Make the smallest coherent change and update relevant documentation.
4. Run checks that cover the affected behavior. For a general validation pass, use `npm test`, `npm run typecheck`, `npm run build`, `npm run check:bundle`, and `npm run lint`.
5. Open a pull request explaining the problem, resulting behavior, and actual validation results.

Some inherited lint findings are tracked separately. State which failures already existed and which your change introduces; do not report a successful build as a clean lint result. For visual changes, include a screenshot without credentials or personal information.

## Measurement and learning content

Use explicit units. Check squared and cubed conversion factors independently of linear factors. Record whether a reference value is measured, sourced, or an approximation, and avoid presenting one object's dimensions as universal for its category.

Keep instructional feedback respectful. The purpose of an implausible comparison is to invite explanation and revision, not to ridicule the learner. Do not claim learning outcomes that have not been evaluated.

## Assets, credentials, and AI assistance

Use material you have permission to redistribute and preserve license notices. Document third-party sources in `THIRD_PARTY_NOTICES.md` when needed. Never include API keys, local model settings, learner records, deployment archives, or private source materials in a contribution.

AI-assisted contributions are welcome when a contributor reviews the result, can explain it, and reports material AI assistance in the pull request. Check generated measurements, code, and attribution. Submit only changes you can maintain and verify.

## Review

The primary maintainer decides whether to merge or release a change. English is preferred for project documentation and discussion; Chinese context is useful when correcting existing Chinese activity content. Review timing depends on maintainer availability.

For sensitive findings, follow [Security](SECURITY.md) instead of posting details publicly.
