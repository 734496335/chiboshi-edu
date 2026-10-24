<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Chiboshi maintenance

- Chiboshi is an independently maintained educational source project. English is the primary documentation language; existing classroom activities and teaching data remain Simplified Chinese until explicitly localized.
- Use `docs/GETTING_STARTED.md`, `docs/ARCHITECTURE.md`, and `CONTRIBUTING.md` for the current workflow. Do not present legacy competition materials as current public project documentation.
- The previous hosted service was retired. Do not run legacy cloud-deployment helpers or restore hosting without a new user request.
- Keep API keys, `llm_config.json`, `.env.local`, operations records, and personal classroom documents out of published commits. Preserve third-party attribution.
- The original private repository history contains deployment credentials and internal material. Prepare releases from the reviewed clean source history, not by making the legacy history public or merging it into the clean branch.
- Preserve pre-existing user changes. Do not fabricate users, classroom adoption, contributor counts, educational validation, or maintenance history.
- Validate source changes with `npm run typecheck` and `npm run build`. Run ESLint on changed files; report existing repository-wide lint debt accurately.
