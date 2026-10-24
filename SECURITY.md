# Security

Chiboshi is an educational application intended to run locally. The supplied local workflow does not establish the controls needed for an internet-facing, multi-user classroom service.

## Local operation

- Keep the server bound to the loopback interface unless you have independently reviewed the consequences of exposing it.
- Keep provider credentials on the server. Do not commit `.env.local`, `llm_config.json`, or deployment credentials.
- Do not enter learner identities or other sensitive information into optional AI prompts. Those requests go to the configured provider.
- Review generated measurements and content before using them with learners.
- Run `npm run check:bundle` after a production build before distributing its output. This checks packaging boundaries; it is not a full security assessment.

## Reporting a vulnerability

If GitHub private vulnerability reporting is enabled for this repository, use **Security → Advisories → Report a vulnerability**. Include the affected version or commit, a minimal reproduction, and the potential impact. Remove secrets and personal information from attachments.

If that private reporting option is unavailable, open an issue that only asks the maintainer to arrange a private reporting channel. Do not include exploit instructions, credentials, or sensitive details in that public request.

Ordinary non-sensitive bugs belong in the issue tracker. There is no guaranteed response time. Fixes are maintained on the current default branch; support for older snapshots is not promised.

## Scope

Report issues in this repository's code or packaging. For vulnerabilities in third-party dependencies or provider services, follow the relevant project's reporting process. Do not test systems or services you do not control.
