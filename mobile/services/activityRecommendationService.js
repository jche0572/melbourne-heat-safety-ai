import { API_BASE_URL } from "../config/api";
import { toMelbourneIso } from "../utils/activityDateTime";
import { getStoredEvents, updateEvent } from "./eventStorageService";
import {
  getPersonalThermalProfile,
} from "./personalThermalService";

const TIMEZONE_SUFFIX =
  /(?:Z|[+-]\d{2}:?\d{2})$/i;

const PROHIBITED_SAFETY_CLAIM =
  /\b(?:medically\s+)?(?:safe|unsafe)\b/i;


function isNonEmptyString(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}


function isTimezoneAwareTimestamp(value) {
  return (
    typeof value === "string" &&
    TIMEZONE_SUFFIX.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}


function containsProhibitedSafetyClaim(value) {
  return (
    typeof value === "string" &&
    PROHIBITED_SAFETY_CLAIM.test(value)
  );
}

// Share pending work across screen instances. Navigation does not cancel persistence.
const pendingRecommendations = new Map();

export function getSavedActivityRecommendation(eventId) {
  const event = getStoredEvents().find(item => item.id === eventId);
  if (!event) return Promise.reject(new Error("Event not found"));
  if (event.activityRecommendation) return Promise.resolve(event.activityRecommendation);
  if (pendingRecommendations.has(eventId)) return pendingRecommendations.get(eventId);

  const pending = (async () => {
    let requestedEvent = event;
    while (true) {
      const result = await getActivityRecommendation(requestedEvent);
      // Re-read after the request: never save an old forecast to a changed schedule.
      const current = getStoredEvents().find(item => item.id === eventId);
      if (!current) throw new Error("Event no longer exists");
      if (current.activityRecommendation) return current.activityRecommendation;
      if (["startDate", "startTime", "endDate", "endTime"].some(
        field => current[field] !== requestedEvent[field]
      )) {
        requestedEvent = current;
        continue;
      }
      const savedRecommendation = current.acceptedRecommendedTime && result.alternativeTimeRecommended
        ? {
            ...result,
            shortRecommendation: "Review the updated forecast and practical advice for this time.",
            recommendation: {
              ...result.recommendation,
              recommendation: "Review the updated forecast and practical advice for this time.",
            },
            alternativeTimeRecommended: false,
            suggestedAlternativeTime: null,
          }
        : result;
      const saved = updateEvent(eventId, { activityRecommendation: savedRecommendation });
      if (!saved) throw new Error("Unable to save recommendation");
      return saved.activityRecommendation;
    }
  })().finally(() => pendingRecommendations.delete(eventId));
  pendingRecommendations.set(eventId, pending);
  return pending;
}

const isDevelopment = typeof __DEV__ !== "undefined" && __DEV__;

export async function getActivityRecommendation(event) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const {
      personalBias,
      feedbackCount,
    } =
      getPersonalThermalProfile();

    const body = {
      activityTitle: event.title,
      location: event.location,
      description: event.description,
      startTime:
        toMelbourneIso(
          event.startDate,
          event.startTime
        ),
      endTime:
        toMelbourneIso(
          event.endDate,
          event.endTime
        ),

      personalThermalBias:
        Number.isFinite(personalBias)
          ? personalBias
          : 0,

      personalFeedbackCount:
        Number.isFinite(feedbackCount)
          ? feedbackCount
          : 0,
    };
    if (Number.isFinite(event.latitude) && Number.isFinite(event.longitude)) {
      body.latitude = event.latitude;
      body.longitude = event.longitude;
    }
    const recommendationUrl = `${API_BASE_URL}/api/ai/activity-recommendation`;
    if (isDevelopment) console.log(`[Recommendation] request -> ${recommendationUrl}`);
    const response = await fetch(recommendationUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: controller.signal,
    });
    if (!response.ok) throw new Error("Recommendation unavailable");
    const data = await response.json();
    if (isDevelopment) {
      console.log(`[Recommendation] source -> ${data?.recommendationStatus}`);
      if (data?.rag) console.log(`[Recommendation] rag -> ${data.rag.status}, retrieved=${data.rag.retrievedCount}`);
    }
    if (
      !isNonEmptyString(data.shortRecommendation) ||
      containsProhibitedSafetyClaim(data.shortRecommendation) ||
      !Array.isArray(data.practicalAdvice) ||
      data.practicalAdvice.length < 2 ||
      data.practicalAdvice.length > 4 ||
      !data.practicalAdvice.every(
        (item) =>
          isNonEmptyString(item) &&
          !containsProhibitedSafetyClaim(item)
      ) ||
      !Array.isArray(data.forecast?.hours) ||
      typeof data.alternativeTimeRecommended !== "boolean"
    ) {
      throw new Error(
        "Invalid recommendation response"
      );
    }
    if (data.alternativeTimeRecommended) {
      const suggested =
        data.suggestedAlternativeTime;

      if (
        !suggested ||
        !isTimezoneAwareTimestamp(
          suggested.startTime
        ) ||
        !isTimezoneAwareTimestamp(
          suggested.endTime
        )
      ) {
        throw new Error(
          "Invalid alternative time"
        );
      }

      const suggestedStart =
        Date.parse(suggested.startTime);

      const suggestedEnd =
        Date.parse(suggested.endTime);

      if (suggestedEnd <= suggestedStart) {
        throw new Error(
          "Invalid alternative time"
        );
      }
    }
    
    const nestedRecommendation = data.recommendation;

    if (
      !nestedRecommendation ||
      !isNonEmptyString(
        nestedRecommendation.recommendation
      ) ||
      !Array.isArray(
        nestedRecommendation.practicalActions
      ) ||
      nestedRecommendation.recommendation !==
        data.shortRecommendation ||
      JSON.stringify(
        nestedRecommendation.practicalActions
      ) !==
        JSON.stringify(data.practicalAdvice)
    ) {
      throw new Error(
        "Recommendation response integrity check failed"
      );
    }
    return data;
  } catch (error) {
    if (isDevelopment) console.error(`[Recommendation] request failed -> ${error?.message ?? String(error)}`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
