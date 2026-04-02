# Implementation Plan

- [x] Initialize Node package and install `@google/clasp`
- [x] Add repository instructions and product spec
- [x] Add Apps Script manifest and local ignore files
- [x] Add `.env` support and a local Script Properties sync step
- [x] Implement core birthday job logic
- [x] Implement Apps Script entrypoints and Google service adapters
- [x] Add local tests for parsing, validation, orchestration, and idempotency
- [x] Run `clasp login`
- [x] Run `clasp create --type standalone --title "Birthday Agent"`
- [ ] Enable `API Executable` once in the Apps Script project
- [ ] Fill `birthday_bot/.env` with real values and run `npm.cmd run sync:props`
- [ ] Verify with a preview run
- [ ] Install the daily trigger
