import localStorage from "./deviceStorage";
import {
  toMelbourneIso,
} from "../utils/activityDateTime";

import {
  getStoredEvents,
} from "./eventStorageService";

/* =========================================================
   VALID FEEDBACK ANSWERS

   Security fix:
   Feedback answers must always be converted into one of these
   canonical values before they are trusted or stored.

   This prevents a tampered localStorage value such as:
   "extremely_hot"
   from being treated as legitimate feedback.
========================================================= */

const VALID_FEEDBACK_ANSWERS = new Set([
  "not_warm",
  "warm",
  "too_hot",
]);


/* =========================================================
   NORMALISE FEEDBACK ANSWER

   The UI or an older stored version may contain a display
   label such as "Too hot" instead of the canonical value
   "too_hot".

   This function converts supported aliases into the same
   trusted internal representation.

   Anything not listed here becomes null and is rejected.
========================================================= */

function normaliseAnswer(answer) {
  const aliases = {
    not_warm: "not_warm",
    "Not warm / OK": "not_warm",

    warm: "warm",
    Warm: "warm",

    too_hot: "too_hot",
    "Too hot": "too_hot",
  };

  return aliases[answer] ?? null;
}


/* =========================================================
   STORAGE KEY

   Stores completed feedback answers in browser localStorage.
========================================================= */

const FEEDBACK_STORAGE_KEY =
  "shadeadapt_feedback";


/* =========================================================
   BUILD TRUSTED FEEDBACK CONTEXT FROM EVENT

   Security fix:
   populationThermal and environment values should be derived
   from the stored event recommendation rather than trusting
   copies that may have been manually changed inside
   shadeadapt_feedback.

   This keeps feedback contextual data consistent with the
   event it belongs to.
========================================================= */

function buildFeedbackContext(event) {
  const activityRecommendation =
    event?.activityRecommendation ?? null;

  const originalActivityThermal =
    activityRecommendation
      ?.originalActivityThermal ?? null;

  const environmentSummary =
    activityRecommendation
      ?.environmentSummary ?? null;

  const forecastHour =
    activityRecommendation
      ?.forecast
      ?.hours
      ?.[0] ?? null;

  return {
    populationThermal: {
      severityScore:
        originalActivityThermal
          ?.worstSeverityScore ?? null,

      predictedLabel:
        originalActivityThermal
          ?.worstPredictedLabel ?? null,

      predictedClass:
        originalActivityThermal
          ?.worstPredictedClass ?? null,
    },

    environment: {
      temperatureC:
        forecastHour
          ?.temperatureC ?? null,

      relativeHumidity:
        forecastHour
          ?.relativeHumidity ?? null,

      windSpeed10mMs:
        forecastHour
          ?.windSpeed10mMs ?? null,

      shortwaveRadiationWm2:
        forecastHour
          ?.shortwaveRadiationWm2 ?? null,

      apparentTemperatureC:
        environmentSummary
          ?.peakApparentTemperatureC ?? null,

      uvIndex:
        environmentSummary
          ?.peakUvIndex ?? null,
    },
  };
}


/* =========================================================
   CHECK IF AN EVENT HAS FINISHED

   Feedback should only become available after the event's
   end date and end time have passed.
========================================================= */

export function hasEventFinished(event) {
  try {
    if (
      !event ||
      !event.endDate ||
      !event.endTime
    ) {
      return false;
    }

    const eventEndIso =
      toMelbourneIso(
        event.endDate,
        event.endTime
      );

    const eventEndTimestamp =
      Date.parse(eventEndIso);

    const currentTimestamp =
      Date.now();

    return (
      Number.isFinite(
        eventEndTimestamp
      ) &&
      currentTimestamp >=
        eventEndTimestamp
    );
  }
  catch (error) {
    console.error(
      "Failed to check event end time:",
      error
    );

    return false;
  }
}


/* =========================================================
   GET ALL STORED FEEDBACK

   Security fix:
   localStorage is controlled by the client and therefore
   must NOT be trusted simply because the data already exists.

   Every feedback record is revalidated when loaded.

   This protects against the penetration-test cases:
   1. Unsupported feedback values
   2. Fabricated event IDs
   3. Duplicate feedback records
   4. Invalid/malformed stored objects

   Invalid or conflicting records are removed from storage.
========================================================= */

export function getStoredFeedback() {
  try {
    const stored =
      localStorage.getItem(
        FEEDBACK_STORAGE_KEY
      );

    if (!stored) {
      return [];
    }

    const parsedFeedback =
      JSON.parse(stored);

    /*
     * The root value must always be an array.
     * If localStorage has been corrupted or manually replaced
     * with another type, reset it safely.
     */
    if (!Array.isArray(parsedFeedback)) {
      console.warn(
        "Stored feedback was not an array and has been reset."
      );

      localStorage.setItem(
        FEEDBACK_STORAGE_KEY,
        JSON.stringify([])
      );

      return [];
    }

    /*
     * Load the real planner events.
     * Feedback must always refer to an existing event.
     */
    const events =
      getStoredEvents();

    const eventMap =
      new Map(
        events.map(
          (event) => [
            event.id,
            event,
          ]
        )
      );


    /* ---------------------------------------------------------
       FIRST PASS: VALIDATE INDIVIDUAL RECORDS

       Build a list containing only structurally valid feedback.

       Records with:
       - fake event IDs
       - unsupported answers
       - invalid timestamps
       - unfinished events
       are rejected here.
    --------------------------------------------------------- */

    const candidateFeedback = [];

    for (const item of parsedFeedback) {
      /*
       * Feedback must be a normal object.
       */
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item)
      ) {
        continue;
      }

      /*
       * Feedback record must have a usable ID.
       */
      if (
        typeof item.id !== "string" ||
        item.id.trim().length === 0
      ) {
        continue;
      }

      /*
       * eventId must exist and must refer to a real
       * planner event.

       This fixes the fabricated-event test:
       fake-event-123 will not be trusted.
       */
      if (
        typeof item.eventId !== "string" ||
        !eventMap.has(item.eventId)
      ) {
        continue;
      }

      /*
       * Convert valid labels/aliases into their canonical
       * representation.

       Unsupported values such as "extremely_hot"
       become null and are rejected.
       */
      const normalisedAnswer =
        normaliseAnswer(item.answer);

      if (
        !normalisedAnswer ||
        !VALID_FEEDBACK_ANSWERS.has(
          normalisedAnswer
        )
      ) {
        continue;
      }

      const event =
        eventMap.get(item.eventId);

      /*
       * Feedback must not exist for an event that has not
       * finished yet.
       */
      if (!hasEventFinished(event)) {
        continue;
      }

      /*
       * submittedAt must contain a valid timestamp.
       */
      if (
        typeof item.submittedAt !== "string" ||
        !Number.isFinite(
          Date.parse(item.submittedAt)
        )
      ) {
        continue;
      }

      candidateFeedback.push({
        item,
        event,
        normalisedAnswer,
      });
    }


    /* ---------------------------------------------------------
       SECOND PASS: DETECT DUPLICATE EVENT ASSOCIATIONS

       There should only be ONE valid feedback record for each
       completed event.

       If two otherwise-valid records exist for the same
       eventId but contain conflicting answers, neither record
       is trusted.

       This prevents ambiguous feedback such as:

       event123 -> warm
       event123 -> too_hot

       from being treated as legitimate completed feedback.
    --------------------------------------------------------- */

    const eventIdCounts =
      new Map();

    for (
      const candidate of candidateFeedback
    ) {
      const eventId =
        candidate.item.eventId;

      eventIdCounts.set(
        eventId,
        (
          eventIdCounts.get(eventId) ??
          0
        ) + 1
      );
    }


    /* ---------------------------------------------------------
       BUILD THE SANITISED FEEDBACK LIST
    --------------------------------------------------------- */

    const validFeedback = [];

    for (
      const candidate of candidateFeedback
    ) {
      const {
        item,
        event,
        normalisedAnswer,
      } = candidate;

      /*
       * More than one valid record for this event means the
       * local feedback state is ambiguous/tampered.

       Reject all conflicting copies rather than arbitrarily
       choosing one.
       */
      if (
        eventIdCounts.get(
          item.eventId
        ) !== 1
      ) {
        continue;
      }

      /*
       * Rebuild environmental and thermal context using the
       * actual event rather than trusting copies from the
       * feedback object.
       */
      const trustedContext =
        buildFeedbackContext(event);

      validFeedback.push({
        id: item.id,

        eventId:
          item.eventId,

        answer:
          normalisedAnswer,

        populationThermal:
          trustedContext
            .populationThermal,

        environment:
          trustedContext.environment,

        submittedAt:
          item.submittedAt,
      });
    }


    /* ---------------------------------------------------------
       REMOVE INVALID/TAMPERED DATA FROM LOCAL STORAGE

       If the cleaned list differs from what was originally
       stored, replace localStorage with the sanitised version.

       This means tampering does not continue surviving every
       application reload.
    --------------------------------------------------------- */

    if (
      JSON.stringify(validFeedback) !==
      JSON.stringify(parsedFeedback)
    ) {
      console.warn(
        "Invalid, fabricated or duplicate feedback was removed."
      );

      localStorage.setItem(
        FEEDBACK_STORAGE_KEY,
        JSON.stringify(
          validFeedback
        )
      );
    }

    return validFeedback;
  }
  catch (error) {
    console.error(
      "Failed to read stored feedback:",
      error
    );

    /*
     * Fail safely.
     * Corrupted JSON must not crash the application or be
     * treated as valid feedback.
     */
    return [];
  }
}


/* =========================================================
   CHECK WHETHER FEEDBACK HAS ALREADY BEEN SUBMITTED
========================================================= */

export function hasFeedbackForEvent(
  eventId
) {
  const feedback =
    getStoredFeedback();

  return feedback.some(
    (item) =>
      item.eventId === eventId
  );
}


/* =========================================================
   GET PENDING FEEDBACK

   A feedback item is pending when:

   1. The event exists.
   2. The event has already finished.
   3. Valid feedback has NOT already been submitted.

   getStoredFeedback() is deliberately used here so that
   tampered/fabricated feedback cannot suppress legitimate
   pending feedback.
========================================================= */

export function getPendingFeedbackEvents() {
  const events =
    getStoredEvents();

  const completedFeedback =
    getStoredFeedback();

  const completedEventIds =
    new Set(
      completedFeedback.map(
        (item) => item.eventId
      )
    );

  return events
    .filter(
      (event) =>
        hasEventFinished(event) &&
        !completedEventIds.has(
          event.id
        )
    )
    .sort(
      (eventA, eventB) => {
        try {
          const endA =
            Date.parse(
              toMelbourneIso(
                eventA.endDate,
                eventA.endTime
              )
            );

          const endB =
            Date.parse(
              toMelbourneIso(
                eventB.endDate,
                eventB.endTime
              )
            );

          return endB - endA;
        }
        catch (_error) {
          return 0;
        }
      }
    );
}


/* =========================================================
   SAVE FEEDBACK

   Security fixes:
   - eventId must refer to a real event.
   - event must already have finished.
   - answer must be one of the permitted values.
   - answer is normalised before storage.
   - recommendation/environment information is taken from
     the actual stored event rather than supplied by the
     caller.
   - an existing feedback record for the same event is
     replaced rather than duplicated.

   Note:
   Feedback is still stored client-side in this iteration.
   localStorage itself cannot be made tamper-proof, therefore
   getStoredFeedback() always revalidates stored records.
========================================================= */

export function saveFeedback(
  eventId,
  answer
) {
  try {
    /*
     * Validate the supplied event identifier format.
     */
    if (
      typeof eventId !== "string" ||
      eventId.trim().length === 0
    ) {
      throw new Error(
        "A valid event ID is required."
      );
    }

    /*
     * Normalise the answer before checking it.

     * This means both:
     * "Too hot"
     * and
     * "too_hot"
     *
     * become:
     * "too_hot"
     */
    const normalisedAnswer =
      normaliseAnswer(answer);

    if (
      !normalisedAnswer ||
      !VALID_FEEDBACK_ANSWERS.has(
        normalisedAnswer
      )
    ) {
      throw new Error(
        "A valid feedback answer is required."
      );
    }

    /*
     * Verify that the event actually exists.

     * This prevents code from directly calling:
     *
     * saveFeedback(
     *   "fake-event-123",
     *   "warm"
     * )
     */
    const events =
      getStoredEvents();

    const event =
      events.find(
        (item) =>
          item.id === eventId
      );

    if (!event) {
      throw new Error(
        "The feedback event does not exist."
      );
    }

    /*
     * Feedback may only be submitted after the event
     * has finished.
     */
    if (!hasEventFinished(event)) {
      throw new Error(
        "Feedback cannot be submitted before the event has finished."
      );
    }

    /*
     * Load existing feedback through the secured loader.

     * This automatically removes malformed, fabricated or
     * duplicate records before new feedback is saved.
     */
    const existingFeedback =
      getStoredFeedback();

    /*
     * Normal UI behaviour should maintain one feedback
     * record per event.

     * If feedback already exists for this event,
     * replace it instead of creating a duplicate.
     */
    const feedbackWithoutCurrentEvent =
      existingFeedback.filter(
        (item) =>
          item.eventId !== eventId
      );

    /*
     * Build environmental/thermal context from the actual
     * stored event rather than trusting data supplied by
     * another function or the browser.
     */
    const trustedContext =
      buildFeedbackContext(event);

    const newFeedback = {
      id:
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,

      eventId,

      /*
       * Always store the canonical answer value.
       */
      answer:
        normalisedAnswer,

      populationThermal:
        trustedContext
          .populationThermal,

      environment:
        trustedContext
          .environment,

      submittedAt:
        new Date().toISOString(),
    };

    const updatedFeedback = [
      ...feedbackWithoutCurrentEvent,
      newFeedback,
    ];

    localStorage.setItem(
      FEEDBACK_STORAGE_KEY,
      JSON.stringify(
        updatedFeedback
      )
    );

    return newFeedback;
  }
  catch (error) {
    console.error(
      "Failed to save feedback:",
      error
    );

    throw error;
  }
}


/* =========================================================
   GET FEEDBACK FOR ONE EVENT

   Uses getStoredFeedback(), so invalid/tampered records have
   already been filtered before they can be returned here.
========================================================= */

export function getFeedbackForEvent(
  eventId
) {
  const feedback =
    getStoredFeedback();

  return (
    feedback.find(
      (item) =>
        item.eventId === eventId
    ) ?? null
  );
}


/* =========================================================
   GET NUMBER OF PENDING FEEDBACK ITEMS

   Useful for:
   - showing whether the feedback reminder is needed
   - displaying a future pending-feedback count

   Because pending status is calculated from validated
   feedback, fabricated feedback cannot incorrectly mark a
   legitimate event as completed.
========================================================= */

export function getPendingFeedbackCount() {
  return (
    getPendingFeedbackEvents()
      .length
  );
}
