const test = require("node:test");
const assert = require("node:assert/strict");

const BirthdayAgent = require("../src/birthday-agent");

test("parseEventDescription normalizes mixed-case keys and whitespace", () => {
  const metadata = BirthdayAgent.parseEventDescription(
    "born on: 03.01.2014\nEMAIL:  maxim.stenske@gmail.com \nStyle of the greeting message:  with love and proudness  "
  );

  assert.deepEqual(metadata, {
    "born on": "03.01.2014",
    email: "maxim.stenske@gmail.com",
    "style of the greeting message": "with love and proudness"
  });
});

test("validateMetadata reports missing required fields", () => {
  const validation = BirthdayAgent.validateMetadata({
    email: "maxim.stenske@gmail.com",
    relationship: "son"
  });

  assert.equal(validation.isValid, false);
  assert.match(validation.errors.join("\n"), /born on/);
  assert.match(validation.errors.join("\n"), /hobbies/);
});

test("sanitizeScriptPropertyValues keeps only supported script properties", () => {
  const sanitized = BirthdayAgent.sanitizeScriptPropertyValues({
    BIRTHDAY_CALENDAR_ID: "calendar-id",
    GEMINI_API_KEY: "secret-key",
    OPENAI_API_KEY: "should-not-pass-through",
    OWNER_EMAIL: " valerian.stenske@gmail.com ",
    TIME_ZONE: " Europe/Berlin "
  });

  assert.deepEqual(sanitized, {
    BIRTHDAY_CALENDAR_ID: "calendar-id",
    GEMINI_API_KEY: "secret-key",
    OWNER_EMAIL: "valerian.stenske@gmail.com",
    TIME_ZONE: "Europe/Berlin"
  });
});

test("runBirthdayJob creates a draft and a summary for a valid event", () => {
  const createdDrafts = [];
  const insertedSummaries = [];
  const logs = [];

  const result = BirthdayAgent.runBirthdayJob({
    adapter: {
      createDraft(draft) {
        createdDrafts.push(draft);
      },
      findDraftBySubject() {
        return null;
      },
      findSummaryMessageBySubject() {
        return null;
      },
      generateGreeting(prompt) {
        assert.match(prompt, /Recipient name: Maxim Stenske/);
        assert.match(prompt, /Turning age: 13/);
        return "Happy Birthday, Maxim!";
      },
      insertSummaryMessage(message) {
        insertedSummaries.push(message);
      },
      listBirthdayEvents() {
        return [
          {
            description:
              "born on: 03.01.2014\nemail: maxim.stenske@gmail.com\nrelationship: son\nhobbies: soccer\nStyle of the greeting message: with love and proudness",
            summary: "Birthday - Maxim Stenske"
          }
        ];
      },
      log(entry) {
        logs.push(entry);
      }
    },
    config: {
      draftSubjectPrefix: "[birthday_greeting]",
      ownerEmail: "valerian.stenske@gmail.com",
      summarySubjectPrefix: "[birthday_greeting-summary]"
    },
    targetDateIso: "2027-01-03"
  });

  assert.equal(result.createdDrafts, 1);
  assert.equal(result.summaryCreated, true);
  assert.equal(createdDrafts.length, 1);
  assert.equal(createdDrafts[0].to, "maxim.stenske@gmail.com");
  assert.equal(
    createdDrafts[0].subject,
    "[birthday_greeting][2027-01-03][maxim.stenske@gmail.com] It's your birthday!"
  );
  assert.equal(insertedSummaries.length, 1);
  assert.equal(
    insertedSummaries[0].subject,
    "[birthday_greeting-summary][2027-01-03] UPCOMING BIRTHDAYS"
  );
  assert.equal(insertedSummaries[0].body, "* Maxim Stenske");
  assert.equal(logs.some((entry) => entry.event === "birthday.draft_created"), true);
});

test("runBirthdayJob skips invalid events and creates no summary", () => {
  const createdDrafts = [];
  const insertedSummaries = [];

  const result = BirthdayAgent.runBirthdayJob({
    adapter: {
      createDraft(draft) {
        createdDrafts.push(draft);
      },
      findDraftBySubject() {
        return null;
      },
      findSummaryMessageBySubject() {
        return null;
      },
      generateGreeting() {
        return "unused";
      },
      insertSummaryMessage(message) {
        insertedSummaries.push(message);
      },
      listBirthdayEvents() {
        return [
          {
            description:
              "born on: not-a-date\nrelationship: son\nhobbies: soccer\nStyle of the greeting message: warm",
            summary: "Birthday - Maxim Stenske"
          }
        ];
      },
      log() {}
    },
    config: {
      ownerEmail: "valerian.stenske@gmail.com"
    },
    targetDateIso: "2027-01-03"
  });

  assert.equal(result.createdDrafts, 0);
  assert.equal(result.skippedEvents, 1);
  assert.equal(result.summaryCreated, false);
  assert.equal(createdDrafts.length, 0);
  assert.equal(insertedSummaries.length, 0);
});

test("runBirthdayJob includes invalid events in the summary when at least one draft exists", () => {
  const insertedSummaries = [];

  const result = BirthdayAgent.runBirthdayJob({
    adapter: {
      createDraft() {},
      findDraftBySubject() {
        return null;
      },
      findSummaryMessageBySubject() {
        return null;
      },
      generateGreeting() {
        return "Happy Birthday, Maxim!";
      },
      insertSummaryMessage(message) {
        insertedSummaries.push(message);
      },
      listBirthdayEvents() {
        return [
          {
            description:
              "born on: 03.01.2014\nemail: maxim.stenske@gmail.com\nrelationship: son\nhobbies: soccer\nStyle of the greeting message: with love and proudness",
            summary: "Birthday - Maxim Stenske"
          },
          {
            description:
              "born on: not-a-date\nrelationship: friend\nhobbies: tennis\nStyle of the greeting message: warm",
            summary: "Birthday - Person B"
          }
        ];
      },
      log() {}
    },
    config: {
      ownerEmail: "valerian.stenske@gmail.com"
    },
    targetDateIso: "2027-01-03"
  });

  assert.equal(result.createdDrafts, 1);
  assert.equal(result.skippedEvents, 1);
  assert.equal(result.summaryCreated, true);
  assert.equal(insertedSummaries.length, 1);
  assert.equal(
    insertedSummaries[0].body,
    "* Maxim Stenske\n* Person B (invalid: Missing required field: email; Invalid born on date: not-a-date)"
  );
});

test("runBirthdayJob is idempotent when draft and summary already exist", () => {
  const createdDrafts = [];
  const insertedSummaries = [];

  const result = BirthdayAgent.runBirthdayJob({
    adapter: {
      createDraft(draft) {
        createdDrafts.push(draft);
      },
      findDraftBySubject(subject) {
        return { id: "draft-1", subject };
      },
      findSummaryMessageBySubject(subject) {
        return { id: "message-1", subject };
      },
      generateGreeting() {
        throw new Error("generateGreeting should not be called");
      },
      insertSummaryMessage(message) {
        insertedSummaries.push(message);
      },
      listBirthdayEvents() {
        return [
          {
            description:
              "born on: 03.01.2014\nemail: maxim.stenske@gmail.com\nrelationship: son\nhobbies: soccer\nStyle of the greeting message: with love and proudness",
            summary: "Birthday - Maxim Stenske"
          }
        ];
      },
      log() {}
    },
    config: {
      ownerEmail: "valerian.stenske@gmail.com"
    },
    targetDateIso: "2027-01-03"
  });

  assert.equal(result.createdDrafts, 0);
  assert.equal(result.existingDrafts, 1);
  assert.equal(result.summaryCreated, false);
  assert.equal(createdDrafts.length, 0);
  assert.equal(insertedSummaries.length, 0);
});

test("runBirthdayJob handles multiple valid events in one summary", () => {
  const insertedSummaries = [];

  const result = BirthdayAgent.runBirthdayJob({
    adapter: {
      createDraft() {},
      findDraftBySubject() {
        return null;
      },
      findSummaryMessageBySubject() {
        return null;
      },
      generateGreeting() {
        return "Happy Birthday!";
      },
      insertSummaryMessage(message) {
        insertedSummaries.push(message);
      },
      listBirthdayEvents() {
        return [
          {
            description:
              "born on: 03.01.2014\nemail: maxim.stenske@gmail.com\nrelationship: son\nhobbies: soccer\nStyle of the greeting message: with love and proudness",
            summary: "Birthday - Maxim Stenske"
          },
          {
            description:
              "born on: 03.01.2010\nemail: personb@example.com\nrelationship: friend\nhobbies: chess\nStyle of the greeting message: warm\nlanguage: German",
            summary: "Birthday - Person B"
          }
        ];
      },
      log() {}
    },
    config: {
      ownerEmail: "valerian.stenske@gmail.com"
    },
    targetDateIso: "2027-01-03"
  });

  assert.equal(result.createdDrafts, 2);
  assert.equal(insertedSummaries.length, 1);
  assert.equal(insertedSummaries[0].body, "* Maxim Stenske\n* Person B");
});
