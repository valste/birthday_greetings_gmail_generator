# Birthday Agent Spec

## Goal
Generate birthday greeting drafts from Google Calendar birthdays and create a summary inbox message for the owner.

## Runtime
- Platform: Google Apps Script
- Local sync: `clasp`
- Timezone: `Europe/Berlin`
- Trigger: daily in the 23:00 hour window

## Inputs
- Calendar: `My Birthdays` by default, or a configured calendar id
- Event description contract:
  - `born on: DD.MM.YYYY`
  - `email: user@example.com`
  - `relationship: ...`
  - `hobbies: ...`
  - `Style of the greeting message: ...`
  - `language: ...` optional

## Outputs
- One Gmail draft per valid birthday event for the next day
  - Subject: `[birthday_greeting][YYYY-MM-DD][recipient_email] It's your birthday!`
  - Body: Gemini-generated plain text only
- One inserted inbox summary message for the owner if at least one birthday draft exists for that target date
  - Subject: `[birthday_greeting-summary][YYYY-MM-DD] UPCOMING BIRTHDAYS`
  - Labels: `INBOX`, `UNREAD`, `IMPORTANT`

## Behavioral rules
- Query only all-day events on the target date.
- Parse description keys case-insensitively and normalize surrounding whitespace.
- Required metadata fields must all be present and non-empty or the event is skipped.
- `born on` must parse as `DD.MM.YYYY`; invalid dates are skipped.
- Derive the person name from the event summary by removing the `Birthday - ` prefix if present.
- Compute the age on the birthday date and include it in the Gemini prompt when available.
- Skip creating a draft when an exact-subject draft already exists.
- Skip creating a summary message when an exact-subject summary message already exists.
- Continue processing other events after per-event failures.

## Configuration
Script Properties:
- `OWNER_EMAIL` required
- `BIRTHDAY_CALENDAR_ID` optional
- `BIRTHDAY_CALENDAR_NAME` optional, default `My Birthdays`
- `GEMINI_API_KEY` required
- `GEMINI_MODEL` optional, default `gemini-2.5-flash`
- `DRAFT_SUBJECT_PREFIX` optional, default `[birthday_greeting]`
- `SUMMARY_SUBJECT_PREFIX` optional, default `[birthday_greeting-summary]`

## Acceptance criteria
- A valid birthday event for tomorrow produces a draft and a summary message.
- Invalid events do not stop the run and are included in the summary message as skipped or invalid entries.
- Rerunning the job for the same date does not duplicate drafts or summary messages.
- Logs are structured JSON and include `timestamp`, `level`, `event`, `message`, `request_id`, `person`, and `birthday_date` when available.
