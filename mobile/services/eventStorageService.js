import localStorage from "./deviceStorage";
import {
  toMelbourneIso,
  eventTimeFields,
} from "../utils/activityDateTime";

// The key/name used to store all events inside browser localStorage.
const EVENT_STORAGE_KEY = "shadeadapt_events";

const OVERLAP_ERROR_MESSAGE =
  "This time overlaps with an existing event. Please choose another time.";

/*
 * Validate an event read from localStorage.
 *
 * localStorage is client-controlled data, so previously
 * stored values should not automatically be trusted.
 */
function isValidTime(value) {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  return (
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

function eventsOverlap(candidate, existing) {
  return (
    candidate.startDate === existing.startDate &&
    candidate.startTime < existing.endTime &&
    candidate.endTime > existing.startTime
  );
}

function isValidStoredEvent(event) {
  // Event must be a normal object.
  if (
    !event ||
    typeof event !== "object" ||
    Array.isArray(event)
  ) {
    return false;
  }

  // Required text fields.
  if (
    typeof event.id !== "string" ||
    event.id.trim().length === 0 ||
    typeof event.title !== "string" ||
    event.title.trim().length === 0 ||
    typeof event.location !== "string" ||
    event.location.trim().length === 0
  ) {
    return false;
  }

  // Required date/time fields must exist.
  if (
    typeof event.startDate !== "string" ||
    typeof event.endDate !== "string" ||
    typeof event.startTime !== "string" ||
    typeof event.endTime !== "string"
  ) {
    return false;
  }

  try {
    // Reuse the same Melbourne date/time validation
    // used when events are originally created.
    if (
      !isValidTime(event.startTime) ||
      !isValidTime(event.endTime)
    ) {
      return false;
    }
    
    const startTimestamp = Date.parse(
      toMelbourneIso(
        event.startDate,
        event.startTime
      )
    );

    const endTimestamp = Date.parse(
      toMelbourneIso(
        event.endDate,
        event.endTime
      )
    );

    // End must be later than start.
    if (
      !Number.isFinite(startTimestamp) ||
      !Number.isFinite(endTimestamp) ||
      endTimestamp <= startTimestamp
    ) {
      return false;
    }
  } catch (_error) {
    // Invalid dates or times such as "99:99"
    // are rejected here.
    return false;
  }

  return true;
}

/*
 * Get every event saved on this browser/device.
 */
export function getStoredEvents() {

  // try is used because reading/parsing localStorage can fail.
  try {

    // Read the saved event data from browser localStorage.
    // localStorage.getItem() returns a string or null.
    const stored =
      localStorage.getItem(
        EVENT_STORAGE_KEY
      );

    // If nothing has been saved yet,
    // return an empty array instead of null.
    if (!stored) {
      return [];
    }

    // localStorage stores data as text.
    // JSON.parse() converts the stored JSON text
    // back into a JavaScript array/object.
    const parsedEvents =
      JSON.parse(stored);

    // The stored top-level value must be an array.
    if (!Array.isArray(parsedEvents)) {
      console.warn(
        "Stored events were not a valid array."
      );

      localStorage.setItem(
        EVENT_STORAGE_KEY,
        JSON.stringify([])
      );

      return [];
    }

    // Validate every event independently.
    const validEvents =
      parsedEvents.filter(
        isValidStoredEvent
      );

    // If tampered or corrupted events were found,
    // remove them from persistent storage.
    if (
      validEvents.length !==
      parsedEvents.length
    ) {
      console.warn(
        "Invalid stored event data was removed."
      );

      localStorage.setItem(
        EVENT_STORAGE_KEY,
        JSON.stringify(validEvents)
      );
    }

    return validEvents;

  // catch runs if localStorage or JSON.parse() causes an error.
  } catch (error) {

    // Print the technical error in the browser console.
    console.error(
      "Failed to read stored events:",
      error
    );

    // If reading fails, return an empty event list
    // so the application can continue running.
    return [];
  }
}

/*
 * Save one new event.
 */
export function saveEvent(event) {
  // Saving can fail, so use try/catch.
  try {
    // Get all events that are already stored.
    const existingEvents =
      getStoredEvents();

    // Build the new event object.
    const newEvent = {
      /*
       * Simple unique ID
       */

      // Date.now() gives the current timestamp in milliseconds.
      // Math.random() creates a random number.
      // Together they create a simple event ID.
      id:
        `${Date.now()}-${Math.random()

          // Convert the random number to a base-36 string
          // using numbers and letters.
          .toString(36)

          // Keep only characters from position 2 to 8
          // to create a short random part of the ID.
          .slice(2, 8)}`,

      // Copy every property from the event object
      // passed into saveEvent().
      ...event,

      // Store the exact date/time when the event was created.
      // toISOString() converts the Date into standard ISO format.
      createdAt:
        new Date().toISOString(),
    };

    if (
      existingEvents.some(
        (existingEvent) =>
          eventsOverlap(newEvent, existingEvent)
      )
    ) {
      throw new Error(
        OVERLAP_ERROR_MESSAGE
      );
    }

    // Create a new array containing:
    // 1. all existing events
    // 2. the newly created event
    const updatedEvents = [
      // Spread all existing events into the new array.
      ...existingEvents,
      // Add the new event at the end.
      newEvent,
    ];

    // Save the updated event array into browser localStorage.
    localStorage.setItem(
      // The storage key/name.
      EVENT_STORAGE_KEY,

      // localStorage only stores strings,
      // so JSON.stringify() converts the array into JSON text.
      JSON.stringify(
        updatedEvents
      )
    );

    // Return the newly created event
    // so the caller can use its ID and other values.
    return newEvent;

  // If anything fails while saving,
  // catch the error here.
  } catch (error) {
    // Print the technical error for debugging.
    if (error.message !== OVERLAP_ERROR_MESSAGE) {
      console.error("Failed to save event:", error);
    }

    // Re-throw the same error.
    // This allows the screen that called saveEvent()
    // to handle and display the error.
    throw error;
  }
}

/*
 * Delete an event later.
 */
export function deleteEvent(
  eventId
) {
  // Deleting may fail, so use try/catch.
  try {
    // Load all currently saved events.
    const existingEvents =
      getStoredEvents();

    // filter() creates a new array.
    // Keep every event whose ID does NOT match eventId.
    // The matching event is therefore removed.
    const updatedEvents =
      existingEvents.filter(
        // Run this condition for each event.
        (event) =>
          // !== means "not equal".
          // Keep the event if its ID is different
          // from the ID we want to delete.
          event.id !==
          eventId
      );

    // Save the filtered event list back into localStorage.
    localStorage.setItem(
      // Use the same storage key.
      EVENT_STORAGE_KEY,

      // Convert the JavaScript array into JSON text.
      JSON.stringify(
        updatedEvents
      )
    );

  // Runs if deleting or saving fails.
  } catch (error) {
    // Print the error in the developer console.
    console.error(
      "Failed to delete event:",
      error
    );

    // Send the error back to the code that called deleteEvent().
    throw error;
  }
}

/*
 * Update an existing event later.
 */
export function updateEvent(
  eventId,
  updatedData
) {
  // Updating may fail, so wrap it in try/catch.
  try {
    // Load all currently saved events.
    const existingEvents =
      getStoredEvents();

    const existingEvent =
      existingEvents.find(
        (event) =>
          event.id === eventId
      );

    const scheduleFields = [
      "startDate",
      "endDate",
      "startTime",
      "endTime",
    ];

    const scheduleChanged =
      existingEvent &&
      scheduleFields.some(
        (field) =>
          Object.prototype.hasOwnProperty.call(
            updatedData,
            field
          ) &&
          updatedData[field] !==
            existingEvent[field]
      );

    if (
      scheduleChanged
    ) {
      const candidateEvent = {
        ...existingEvent,
        ...updatedData,
      };

      if (
        existingEvents.some(
          (event) =>
            event.id !== eventId &&
            eventsOverlap(candidateEvent, event)
        )
      ) {
        throw new Error(
          OVERLAP_ERROR_MESSAGE
        );
      }
    }


    // map() goes through every existing event
    // and creates a new event array.
    const updatedEvents =
      existingEvents.map(
        // Run this function once for every event.
        (event) => {
          // Check whether this is NOT the event
          // that we want to update.
          if (event.id !== eventId) {
            // If the ID does not match,
            // return the original event unchanged.
            return event;
          }
          // If the ID matches,
          // return a new updated version of the event.
          return {
            // Copy all properties from the existing event first.
            ...event,

            // Guidance for the previous schedule must not survive a time change.
            ...(scheduleChanged ? { acceptedRecommendedTime: false, activityRecommendation: null } : {}),

            // Copy all new properties from updatedData.
            // Because this comes after ...event,
            // matching properties will overwrite the old values.
            ...updatedData,

            // Record when the event was updated.
            updatedAt:
              new Date().toISOString(),
          };
        }
      );

    // Save the complete updated event list back to localStorage.
    localStorage.setItem(
      // Storage key.
      EVENT_STORAGE_KEY,

      // Convert the updated array into JSON text.
      JSON.stringify(
        updatedEvents
      )
    );

    // find() searches through the updated event array
    // and returns the event whose ID matches eventId.
    return updatedEvents.find(
      // Check each event.
      (event) =>
        // === means strictly equal.
        // Return the event with the matching ID.
        event.id === eventId
    );

  // Runs if updating or saving fails.
  } catch (error) {
    // Print the error for debugging.
    if (error.message !== OVERLAP_ERROR_MESSAGE) {
      console.error("Failed to update event:", error);
    }

    // Pass the error back to the caller.
    throw error;
  }
}

export function changeEventToRecommendedTime(eventId, suggestedTime) {
  const fields = eventTimeFields(
    suggestedTime.startTime,
    suggestedTime.endTime
  );

  if (
    fields.startDate !== fields.endDate ||
    fields.endTime <= fields.startTime
  ) {
    throw new Error("The recommended time must stay within one day.");
  }

  const updated = updateEvent(eventId, {
    ...fields,
    activityRecommendation: null,
    acceptedRecommendedTime: true,
  });

  if (!updated) throw new Error("The event could not be found on this device.");
  return updated;
}
