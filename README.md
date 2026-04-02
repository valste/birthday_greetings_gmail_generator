# Birthday Agent

Google Apps Script that reads upcoming birthdays from `My Birthdays`, generates Gemini-based greeting drafts, and inserts a summary message into the owner's inbox.

## Local setup
1. Install dependencies:
   - `npm.cmd install`
2. Authenticate `clasp` with your Google account:
   - `npx.cmd clasp login`
3. Create or link the Apps Script project:
   - `npx.cmd clasp create --type standalone --title "Birthday Agent"`
4. Create `birthday_bot/.env` and fill the required properties.
5. Push the local files:
   - `npx.cmd clasp push`
6. Open the Apps Script editor:
   - `npx.cmd clasp open`

## Local environment
Store runtime properties in `birthday_bot/.env`. This file is ignored by both Git and `clasp`.

Required or recommended keys:
- `OWNER_EMAIL=valerian.stenske@gmail.com`
- `BIRTHDAY_CALENDAR_NAME=My Birthdays`
- `GEMINI_API_KEY=...`
- `GEMINI_MODEL=gemini-2.5-flash`
- `TIME_ZONE=Europe/Berlin`
- `DRAFT_SUBJECT_PREFIX=[birthday_greeting]`
- `SUMMARY_SUBJECT_PREFIX=[birthday_greeting-summary]`
- `BIRTHDAY_CALENDAR_ID=...` optional

Enable the Advanced Gmail service in the Apps Script project before running the script.

## Script Properties sync
Sync the `.env` values into Apps Script Script Properties with:
- `npm.cmd run sync:props`

This command pushes the latest Apps Script code and then calls the remote `syncScriptProperties()` helper.
Before the first successful sync, open the Apps Script editor and enable `API Executable` under `Deploy > Test deployments`.

## Entrypoints
- `runDailyBirthdayJob()` runs for tomorrow in the script timezone.
- `previewDailyBirthdayJob(targetDateIso)` runs the same flow for a supplied `YYYY-MM-DD`.
- `installDailyTrigger()` creates one daily trigger in the 23:00 hour window.

## Local tests
- `npm.cmd test`

## Manual verification
1. Create a test event in `My Birthdays` for tomorrow with the required description fields.
2. Run `npm.cmd run sync:props`.
3. Run `previewDailyBirthdayJob('YYYY-MM-DD')` in Apps Script.
4. Confirm a draft appears with a subject starting with `[birthday_greeting]`.
5. Confirm a summary message appears in the inbox with `[birthday_greeting-summary]`.
6. Confirm the summary is marked important.
7. Run the preview again and confirm no duplicates are created.

## Notes
- Gmail drafts cannot receive custom labels, so draft identification uses deterministic subject prefixes.
- Apps Script daily triggers run within the selected hour window rather than at an exact second.
