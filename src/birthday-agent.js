var BirthdayAgent = (function () {
  var REQUIRED_METADATA_FIELDS = [
    "born on",
    "email",
    "relationship",
    "hobbies",
    "style of the greeting message"
  ];
  var SCRIPT_PROPERTY_KEYS = [
    "OWNER_EMAIL",
    "BIRTHDAY_CALENDAR_ID",
    "BIRTHDAY_CALENDAR_NAME",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "TIME_ZONE",
    "DRAFT_SUBJECT_PREFIX",
    "SUMMARY_SUBJECT_PREFIX"
  ];

  var DEFAULT_CONFIG = {
    birthdayCalendarName: "My Birthdays",
    draftSubjectPrefix: "[birthday_greeting]",
    geminiModel: "gemini-2.5-flash",
    summarySubjectPrefix: "[birthday_greeting-summary]",
    timeZone: "Europe/Berlin"
  };

  function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function parseEventDescription(description) {
    var metadata = {};
    String(description || "")
      .split(/\r?\n/)
      .forEach(function (line) {
        var separatorIndex = line.indexOf(":");
        if (separatorIndex === -1) {
          return;
        }
        var key = normalizeWhitespace(line.slice(0, separatorIndex).toLowerCase());
        var value = normalizeWhitespace(line.slice(separatorIndex + 1));
        if (!key || !value) {
          return;
        }
        metadata[key] = value;
      });
    return metadata;
  }

  function parseGermanDate(value) {
    var match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(value || "").trim());
    if (!match) {
      return null;
    }
    var day = Number(match[1]);
    var month = Number(match[2]);
    var year = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return { day: day, month: month, year: year };
  }

  function parseIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
    if (!match) {
      return null;
    }
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return { day: day, month: month, year: year };
  }

  function computeAgeOnDate(bornOn, birthdayDateIso) {
    var birth = parseGermanDate(bornOn);
    var target = parseIsoDate(birthdayDateIso);
    if (!birth || !target) {
      return null;
    }
    var age = target.year - birth.year;
    if (
      target.month < birth.month ||
      (target.month === birth.month && target.day < birth.day)
    ) {
      age -= 1;
    }
    return age >= 0 ? age : null;
  }

  function extractPersonName(summary) {
    var normalized = normalizeWhitespace(summary);
    return normalized.replace(/^Birthday\s*-\s*/i, "") || normalized;
  }

  function validateMetadata(metadata) {
    var errors = [];
    REQUIRED_METADATA_FIELDS.forEach(function (field) {
      if (!normalizeWhitespace(metadata[field])) {
        errors.push("Missing required field: " + field);
      }
    });

    if (metadata["born on"] && !parseGermanDate(metadata["born on"])) {
      errors.push("Invalid born on date: " + metadata["born on"]);
    }

    if (
      metadata.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(metadata.email)
    ) {
      errors.push("Invalid email address: " + metadata.email);
    }

    return {
      errors: errors,
      isValid: errors.length === 0,
      normalized: {
        bornOn: metadata["born on"] || "",
        email: metadata.email || "",
        hobbies: metadata.hobbies || "",
        language: metadata.language || "English",
        relationship: metadata.relationship || "",
        styleOfGreetingMessage: metadata["style of the greeting message"] || ""
      }
    };
  }

  function sanitizeScriptPropertyValues(values) {
    var source = values || {};
    var sanitized = {};
    SCRIPT_PROPERTY_KEYS.forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        return;
      }
      sanitized[key] = normalizeWhitespace(source[key]);
    });
    return sanitized;
  }

  function buildDraftSubject(prefix, birthdayDateIso, recipientEmail) {
    return (
      prefix +
      "[" +
      birthdayDateIso +
      "][" +
      recipientEmail +
      "] It's your birthday!"
    );
  }

  function buildSummarySubject(prefix, birthdayDateIso) {
    return prefix + "[" + birthdayDateIso + "] UPCOMING BIRTHDAYS";
  }

  function buildSummaryBody(names) {
    return names
      .map(function (entry) {
        if (typeof entry === "string") {
          return "* " + entry;
        }
        return "* " + entry.name + " (" + entry.status + ": " + entry.reason + ")";
      })
      .join("\n");
  }

  function buildGreetingPrompt(input) {
    var lines = [
      "Write a warm birthday email body only.",
      "Do not include a subject line.",
      "Use plain text only.",
      "Keep the tone personal and specific.",
      "Recipient name: " + input.personName,
      "Relationship: " + input.relationship,
      "Hobbies: " + input.hobbies,
      "Desired style: " + input.styleOfGreetingMessage,
      "Language: " + input.language
    ];
    if (typeof input.age === "number") {
      lines.push("Turning age: " + input.age);
    }
    lines.push("Birthday date: " + input.birthdayDateIso);
    lines.push("Owner signature context: Dad");
    return lines.join("\n");
  }

  function createRequestId() {
    if (typeof Utilities !== "undefined" && Utilities.getUuid) {
      return Utilities.getUuid();
    }
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "request-" + Date.now();
  }

  function getCurrentIsoTimestamp() {
    return new Date().toISOString();
  }

  function serializeError(error) {
    if (!error) {
      return { message: "Unknown error", name: "Error" };
    }
    return {
      code: error.code || "",
      message: error.message || String(error),
      name: error.name || "Error",
      stack: error.stack || ""
    };
  }

  function logStructured(baseLogger, entry) {
    var payload = Object.assign(
      {
        timestamp: getCurrentIsoTimestamp()
      },
      entry
    );

    if (baseLogger) {
      baseLogger(payload);
      return;
    }

    if (typeof console !== "undefined" && console.log) {
      console.log(JSON.stringify(payload));
      return;
    }

    if (typeof Logger !== "undefined" && Logger.log) {
      Logger.log(JSON.stringify(payload));
    }
  }

  function uniqueStrings(values) {
    return Array.from(
      new Set(
        values.filter(function (value) {
          return Boolean(value);
        })
      )
    );
  }

  function runBirthdayJob(options) {
    var adapter = options.adapter;
    var config = Object.assign({}, DEFAULT_CONFIG, options.config || {});
    var requestId = options.requestId || createRequestId();
    var birthdayDateIso = options.targetDateIso;
    var events = adapter.listBirthdayEvents(birthdayDateIso);
    var draftedNames = [];
    var invalidSummaryEntries = [];
    var result = {
      birthdayDateIso: birthdayDateIso,
      createdDrafts: 0,
      errors: 0,
      existingDrafts: 0,
      processedEvents: events.length,
      requestId: requestId,
      skippedEvents: 0,
      summaryCreated: false
    };

    function log(level, event, message, extra) {
      logStructured(
        adapter.log,
        Object.assign(
          {
            event: event,
            level: level,
            message: message,
            request_id: requestId
          },
          extra || {}
        )
      );
    }

    events.forEach(function (event) {
      var personName = extractPersonName(event.summary);
      var metadata = parseEventDescription(event.description || "");
      var validation = validateMetadata(metadata);

      if (!validation.isValid) {
        result.skippedEvents += 1;
        invalidSummaryEntries.push({
          name: personName,
          reason: validation.errors.join("; "),
          status: "invalid"
        });
        log("warn", "birthday.event_skipped", "Event metadata is invalid", {
          birthday_date: birthdayDateIso,
          errors: validation.errors,
          person: personName
        });
        return;
      }

      var normalized = validation.normalized;
      var draftSubject = buildDraftSubject(
        config.draftSubjectPrefix,
        birthdayDateIso,
        normalized.email
      );

      if (adapter.findDraftBySubject(draftSubject)) {
        result.existingDrafts += 1;
        draftedNames.push(personName);
        log("info", "birthday.draft_exists", "Draft already exists", {
          birthday_date: birthdayDateIso,
          person: personName,
          subject: draftSubject
        });
        return;
      }

      var prompt = buildGreetingPrompt({
        age: computeAgeOnDate(normalized.bornOn, birthdayDateIso),
        birthdayDateIso: birthdayDateIso,
        hobbies: normalized.hobbies,
        language: normalized.language,
        personName: personName,
        relationship: normalized.relationship,
        styleOfGreetingMessage: normalized.styleOfGreetingMessage
      });

      try {
        var body = normalizeWhitespace(adapter.generateGreeting(prompt));
        if (!body) {
          throw new Error("Gemini returned an empty response");
        }

        adapter.createDraft({
          body: body,
          subject: draftSubject,
          to: normalized.email
        });
        draftedNames.push(personName);
        result.createdDrafts += 1;
        log("info", "birthday.draft_created", "Draft created", {
          birthday_date: birthdayDateIso,
          person: personName,
          subject: draftSubject
        });
      } catch (error) {
        result.errors += 1;
        log("error", "birthday.draft_failed", "Failed to create birthday draft", {
          birthday_date: birthdayDateIso,
          error: serializeError(error),
          person: personName
        });
      }
    });

    var uniqueDraftedNames = uniqueStrings(draftedNames);
    if (uniqueDraftedNames.length > 0) {
      var summaryEntries = uniqueDraftedNames.concat(invalidSummaryEntries);
      var summarySubject = buildSummarySubject(
        config.summarySubjectPrefix,
        birthdayDateIso
      );

      if (!adapter.findSummaryMessageBySubject(summarySubject)) {
        adapter.insertSummaryMessage({
          body: buildSummaryBody(summaryEntries),
          important: true,
          subject: summarySubject,
          to: config.ownerEmail
        });
        result.summaryCreated = true;
        log("info", "birthday.summary_created", "Summary message inserted", {
          birthday_date: birthdayDateIso,
          subject: summarySubject
        });
      } else {
        log("info", "birthday.summary_exists", "Summary already exists", {
          birthday_date: birthdayDateIso,
          subject: summarySubject
        });
      }
    } else {
      log("info", "birthday.no_upcoming_birthdays", "No draftable birthdays found", {
        birthday_date: birthdayDateIso
      });
    }

    return result;
  }

  function dateToIsoInTimeZone(date, timeZone) {
    if (typeof Utilities !== "undefined" && Utilities.formatDate) {
      return Utilities.formatDate(date, timeZone, "yyyy-MM-dd");
    }

    var formatter = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timeZone,
      year: "numeric"
    });
    return formatter.format(date);
  }

  function getTargetDateIsoFromNow(now, timeZone) {
    var nowDate = now || new Date();
    if (typeof Utilities !== "undefined" && Utilities.formatDate) {
      var todayIso = Utilities.formatDate(nowDate, timeZone, "yyyy-MM-dd");
      var todayParts = parseIsoDate(todayIso);
      var nextDate = new Date(
        Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day + 1)
      );
      return Utilities.formatDate(nextDate, timeZone, "yyyy-MM-dd");
    }

    var today = parseIsoDate(dateToIsoInTimeZone(nowDate, timeZone));
    var next = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
    return dateToIsoInTimeZone(next, timeZone);
  }

  function getScriptProperties() {
    return PropertiesService.getScriptProperties().getProperties();
  }

  function syncScriptProperties(values) {
    var sanitized = sanitizeScriptPropertyValues(values);
    PropertiesService.getScriptProperties().setProperties(sanitized, false);
    return {
      updatedKeys: Object.keys(sanitized)
    };
  }

  function getConfigFromScriptProperties() {
    var properties = getScriptProperties();
    return {
      birthdayCalendarId: normalizeWhitespace(properties.BIRTHDAY_CALENDAR_ID),
      birthdayCalendarName:
        normalizeWhitespace(properties.BIRTHDAY_CALENDAR_NAME) ||
        DEFAULT_CONFIG.birthdayCalendarName,
      draftSubjectPrefix:
        normalizeWhitespace(properties.DRAFT_SUBJECT_PREFIX) ||
        DEFAULT_CONFIG.draftSubjectPrefix,
      geminiApiKey: normalizeWhitespace(properties.GEMINI_API_KEY),
      geminiModel:
        normalizeWhitespace(properties.GEMINI_MODEL) ||
        DEFAULT_CONFIG.geminiModel,
      ownerEmail: normalizeWhitespace(properties.OWNER_EMAIL),
      summarySubjectPrefix:
        normalizeWhitespace(properties.SUMMARY_SUBJECT_PREFIX) ||
        DEFAULT_CONFIG.summarySubjectPrefix,
      timeZone:
        normalizeWhitespace(properties.TIME_ZONE) ||
        (typeof Session !== "undefined" && Session.getScriptTimeZone
          ? Session.getScriptTimeZone()
          : "") ||
        DEFAULT_CONFIG.timeZone
    };
  }

  function assertRequiredConfig(config) {
    if (!normalizeWhitespace(config.ownerEmail)) {
      throw new Error("Missing required Script Property: OWNER_EMAIL");
    }
    if (!normalizeWhitespace(config.geminiApiKey)) {
      throw new Error("Missing required Script Property: GEMINI_API_KEY");
    }
  }

  function getBirthdayCalendar(config) {
    if (config.birthdayCalendarId) {
      var byId = CalendarApp.getCalendarById(config.birthdayCalendarId);
      if (byId) {
        return byId;
      }
    }

    var calendars = CalendarApp.getCalendarsByName(config.birthdayCalendarName);
    if (!calendars || calendars.length === 0) {
      throw new Error(
        "Birthday calendar not found: " + config.birthdayCalendarName
      );
    }
    return calendars[0];
  }

  function escapeGmailQuery(value) {
    return String(value).replace(/"/g, '\\"');
  }

  function base64EncodeWebSafe(value) {
    if (typeof Utilities !== "undefined" && Utilities.base64EncodeWebSafe) {
      return Utilities.base64EncodeWebSafe(value, Utilities.Charset.UTF_8);
    }
    return Buffer.from(value, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function buildAppsScriptAdapter(config) {
    return {
      createDraft: function (draft) {
        GmailApp.createDraft(draft.to, draft.subject, draft.body);
      },

      findDraftBySubject: function (subject) {
        var drafts = GmailApp.getDrafts();
        for (var index = 0; index < drafts.length; index += 1) {
          if (drafts[index].getMessage().getSubject() === subject) {
            return { id: drafts[index].getId() };
          }
        }
        return null;
      },

      findSummaryMessageBySubject: function (subject) {
        var response = Gmail.Users.Messages.list("me", {
          maxResults: 25,
          q: 'subject:"' + escapeGmailQuery(subject) + '"'
        });
        var messages = (response && response.messages) || [];
        for (var index = 0; index < messages.length; index += 1) {
          var message = Gmail.Users.Messages.get("me", messages[index].id, {
            format: "metadata",
            metadataHeaders: ["Subject"]
          });
          var headers = (((message || {}).payload || {}).headers || []).filter(
            function (header) {
              return String(header.name).toLowerCase() === "subject";
            }
          );
          if (headers.length && headers[0].value === subject) {
            return { id: messages[index].id };
          }
        }
        return null;
      },

      generateGreeting: function (prompt) {
        var response = UrlFetchApp.fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" +
            encodeURIComponent(config.geminiModel) +
            ":generateContent?key=" +
            encodeURIComponent(config.geminiApiKey),
          {
            contentType: "application/json",
            method: "post",
            muteHttpExceptions: true,
            payload: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: prompt
                    }
                  ]
                }
              ]
            })
          }
        );
        var status = response.getResponseCode();
        var body = response.getContentText();
        if (status < 200 || status >= 300) {
          throw new Error("Gemini request failed with status " + status + ": " + body);
        }
        var parsed = JSON.parse(body);
        var parts =
          (((parsed.candidates || [])[0] || {}).content || {}).parts || [];
        var text = parts
          .map(function (part) {
            return part.text || "";
          })
          .join("\n")
          .trim();
        if (!text) {
          throw new Error("Gemini response did not contain text");
        }
        return text;
      },

      insertSummaryMessage: function (message) {
        var rawMessage = [
          "From: " + config.ownerEmail,
          "To: " + message.to,
          "Subject: " + message.subject,
          "Content-Type: text/plain; charset=UTF-8",
          "",
          message.body
        ].join("\r\n");

        var inserted = Gmail.Users.Messages.insert(
          {
            raw: base64EncodeWebSafe(rawMessage)
          },
          "me"
        );

        Gmail.Users.Messages.modify(
          {
            addLabelIds: ["INBOX", "UNREAD", "IMPORTANT"]
          },
          "me",
          inserted.id
        );
      },

      listBirthdayEvents: function (birthdayDateIso) {
        var calendar = getBirthdayCalendar(config);
        var targetDate = new Date(birthdayDateIso + "T00:00:00");
        return calendar
          .getEventsForDay(targetDate)
          .filter(function (event) {
            return event.isAllDayEvent();
          })
          .map(function (event) {
            return {
              description: event.getDescription() || "",
              startDateIso: dateToIsoInTimeZone(
                event.getAllDayStartDate(),
                config.timeZone
              ),
              summary: event.getTitle() || ""
            };
          })
          .filter(function (event) {
            return event.startDateIso === birthdayDateIso;
          });
      },

      log: function (entry) {
        console.log(JSON.stringify(entry));
      }
    };
  }

  function previewDailyBirthdayJob(targetDateIso) {
    var config = getConfigFromScriptProperties();
    assertRequiredConfig(config);
    if (!parseIsoDate(targetDateIso)) {
      throw new Error("targetDateIso must be in YYYY-MM-DD format");
    }
    return runBirthdayJob({
      adapter: buildAppsScriptAdapter(config),
      config: config,
      targetDateIso: targetDateIso
    });
  }

  function runDailyBirthdayJob() {
    var config = getConfigFromScriptProperties();
    assertRequiredConfig(config);
    return runBirthdayJob({
      adapter: buildAppsScriptAdapter(config),
      config: config,
      targetDateIso: getTargetDateIsoFromNow(new Date(), config.timeZone)
    });
  }

  function installDailyTrigger() {
    var handlerName = "runDailyBirthdayJob";
    var triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
      return trigger.getHandlerFunction() === handlerName;
    });

    triggers.slice(1).forEach(function (trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

    if (triggers.length === 0) {
      ScriptApp.newTrigger(handlerName).timeBased().atHour(23).everyDays(1).create();
      return { created: true, handler: handlerName };
    }

    return { created: false, handler: handlerName };
  }

  return {
    buildDraftSubject: buildDraftSubject,
    buildGreetingPrompt: buildGreetingPrompt,
    buildSummaryBody: buildSummaryBody,
    buildSummarySubject: buildSummarySubject,
    computeAgeOnDate: computeAgeOnDate,
    extractPersonName: extractPersonName,
    getTargetDateIsoFromNow: getTargetDateIsoFromNow,
    installDailyTrigger: installDailyTrigger,
    parseEventDescription: parseEventDescription,
    parseGermanDate: parseGermanDate,
    previewDailyBirthdayJob: previewDailyBirthdayJob,
    runBirthdayJob: runBirthdayJob,
    runDailyBirthdayJob: runDailyBirthdayJob,
    sanitizeScriptPropertyValues: sanitizeScriptPropertyValues,
    syncScriptProperties: syncScriptProperties,
    validateMetadata: validateMetadata
  };
})();

if (typeof module !== "undefined") {
  module.exports = BirthdayAgent;
}
