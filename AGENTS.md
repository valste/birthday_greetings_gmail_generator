# AGENTS.md

You are a coding agent working in this repository. Follow these rules exactly.

## 1) Operating principles
- Optimize for correctness, minimal diffs, and maintainability.
- Keep the implementation compatible with Google Apps Script V8 and local Node.js tests.
- Do not introduce extra packages beyond `@google/clasp` unless the task requires them.

## 2) Required workflow
1. Understand: read `README.md`, `spec.md`, and `plans.md` before changing code.
2. Plan: update `plans.md` when taking on a multi-step change.
3. Implement: prefer small edits in `src/`.
4. Test: run `npm test`.
5. Summarize: report changed files, test commands, and any manual Apps Script steps.

## 3) Project commands
- Install: `npm.cmd install`
- Tests: `npm.cmd test`
- Clasp login: `npx.cmd clasp login`
- Create Apps Script project: `npx.cmd clasp create --type standalone --title "Birthday Agent"`
- Push script: `npx.cmd clasp push`
- Pull script: `npx.cmd clasp pull`
- Open script: `npx.cmd clasp open`

## 4) Coding standards
- Keep the core job logic in `src/birthday-agent.js`.
- Keep Apps Script entrypoints in `src/Code.js`.
- Write pure helpers where possible so they are testable under Node.js.
- Emit structured logs as JSON strings.

## 5) Security and privacy
- Never commit real API keys, OAuth tokens, or `.clasp.json`.
- Do not log message bodies, API keys, or full event descriptions.
- Use Script Properties for runtime secrets and configuration.

## 6) Apps Script constraints
- Drafts cannot receive custom Gmail labels; use deterministic subject prefixes.
- Daily triggers in Apps Script run within the requested hour window, not at an exact second.
- Advanced Gmail service must be enabled because the summary message is inserted into the mailbox instead of sent.
