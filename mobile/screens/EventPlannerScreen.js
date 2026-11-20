import { useThemedStyles } from "../theme/useAppTheme";
import React, { useEffect, useMemo, useRef, useState, } from "react";
import { 
    ActivityIndicator, 
    Alert, 
    KeyboardAvoidingView, 
    Modal, Platform, 
    ScrollView, 
    StatusBar, 
    StyleSheet, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    View, } from "react-native";
import { toMelbourneIso } from "../utils/activityDateTime";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import { searchLocations, getPlaceCoordinates, } from "../services/locationSearchService";
import { saveEvent, updateEvent, } from "../services/eventStorageService";

/* =========================================================
 COLOURS
========================================================= */

const SHADE_ADAPT_GREEN = "#39775F";
const PAGE_BACKGROUND = "#EEF2F0";
const IOS_BACKGROUND = "#F2F2F7";
const IOS_SEPARATOR = "#D1D1D6";
const IOS_SECONDARY_TEXT = "#6E6E73";
const ERROR_RED = "#D83B2D";
const WHITE = "#FFFFFF";

/* =========================================================
 TIME OPTIONS
========================================================= */

const HOURS = [
  1, 2, 3, 4, 5, 6,
  7, 8, 9, 10, 11, 12,
];

const MINUTES = [
  0, 5, 10, 15, 20, 25,
  30, 35, 40, 45, 50, 55,
];

const PERIODS = [
  "AM",
  "PM",
];

const WHEEL_ITEM_HEIGHT = 48;
const WHEEL_HEIGHT = 240;

/* =========================================================
 HELPERS
========================================================= */

// Creates an End Time one hour after the selected Start Time.
// Because activities must stay on the same calendar day,
// the latest possible End Time is 11:55 PM.
function getEndTimeOneHourAfter(startParts) {
  const startMinutes =
    timePartsToMinutes(startParts);

  const latestEndMinutes =
    23 * 60 + 55;

  let endMinutes =
    startMinutes + 60;

  if (endMinutes > latestEndMinutes) {
    endMinutes =
      latestEndMinutes;
  }

  /*
   * This should only happen if Start Time itself is 11:55 PM.
   * Returning null prevents Start and End from becoming equal.
   */
  if (endMinutes <= startMinutes) {
    return null;
  }

  const hour24 =
    Math.floor(
      endMinutes / 60
    );

  const minute =
    endMinutes % 60;

  return hour24ToParts(
    hour24,
    minute
  );
}

// Pads a value with a leading zero when needed.
function pad2(value) {
  return String(value).padStart(2, "0");
}

/* =========================================================
 DATE HELPERS
========================================================= */

// Converts a Date into a YYYY-MM-DD key.
function dateToKey(date) {
  return (`${date.getFullYear()}-` +
    `${pad2(date.getMonth() + 1)}-` +
    `${pad2(date.getDate())}`);
}

// Converts a YYYY-MM-DD key into a Date object.
function keyToDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

// Formats a date for the compact date pill.
function formatDatePill(dateKey) {
  return keyToDate(dateKey).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Formats a date as a full readable date.
function formatFullDate(dateKey) {
  return keyToDate(dateKey).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* =========================================================
 TODAY + NEXT 2 DAYS

 Uses the user's browser/device current date.
========================================================= */

// Builds the selectable dates for today and the next two days.
function getAllowedDates() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return [0, 1, 2].map((offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);

    let label;

    if (offset === 0) {
      label = "Today";
    }
    else if (offset === 1) {
      label = "Tomorrow";
    }
    else {
      label = date.toLocaleDateString("en-AU", {
        weekday: "long",
      });
    }

    return {
      key: dateToKey(date),
      label,
      fullDate: date.toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    };
  });
}

/* =========================================================
 TIME HELPERS
========================================================= */

// Rounds minutes down to the nearest 5-minute option.
function normaliseMinute(minute) {
  const value = Number(minute) || 0;
  return Math.min(55, Math.max(0, Math.floor(value / 5) * 5));
}

// Converts 24-hour time into hour, minute, and AM/PM parts.
function hour24ToParts(hour24, minute = 0) {
  const normalisedHour = ((Number(hour24) % 24) + 24) % 24;

  return {
    hour: normalisedHour % 12 || 12,
    minute: normaliseMinute(minute),
    period: normalisedHour >= 12
      ? "PM"
      : "AM",
  };
}

// Converts time parts into HH:MM 24-hour format.
function partsTo24Hour(parts) {
  let hour = Number(parts.hour) % 12;

  if (parts.period === "PM") {
    hour += 12;
  }

  return (`${pad2(hour)}:` +
    `${pad2(parts.minute)}`);
}

// Formats time parts for display in 12-hour format.
function partsToDisplay(parts) {
  return (`${parts.hour}:` +
    `${pad2(parts.minute)} ` +
    `${parts.period}`);
}

// Converts time parts into a numeric 24-hour hour.
function partsToHour24(parts) {
  let hour = Number(parts.hour) % 12;

  if (parts.period === "PM") {
    hour += 12;
  }

  return hour;
}

// Convert picker time into minutes after midnight.
//
// Examples:
// 10:00 AM -> 600
// 2:30 PM  -> 870
function timePartsToMinutes(parts) {
  return (
    partsToHour24(parts) * 60 +
    Number(parts.minute)
  );
}


/* =========================================================
 PARSE TIME FROM OTHER SCREEN
========================================================= */

// Parses incoming time values into the picker time format.
function parseTimeParam(value, fallback) {
  if (value instanceof Date &&
    !Number.isNaN(value.getTime())) {
    return hour24ToParts(value.getHours(), value.getMinutes());
  }

  if (typeof value === "number" &&
    Number.isFinite(value)) {
    return hour24ToParts(value, 0);
  }

  if (typeof value === "string") {
    const trimmed = value
      .trim()
      .toUpperCase();

    const twelveHour = trimmed.match(
      /^(\d{1,2}):(\d{2})\s*(AM|PM)$/
    );

    if (twelveHour) {
      const hour = Number(twelveHour[1]);
      const minute = Number(twelveHour[2]);

      if (hour >= 1 &&
        hour <= 12 &&
        minute >= 0 &&
        minute <= 59) {
        return {
          hour,
          minute: normaliseMinute(minute),
          period: twelveHour[3],
        };
      }
    }

    const twentyFourHour = trimmed.match(
      /^(\d{1,2}):(\d{2})$/
    );

    if (twentyFourHour) {
      const hour = Number(twentyFourHour[1]);
      const minute = Number(twentyFourHour[2]);

      if (hour >= 0 &&
        hour <= 23 &&
        minute >= 0 &&
        minute <= 59) {
        return hour24ToParts(hour, minute);
      }
    }
  }

  return fallback;
}

/* =========================================================
 DEFAULT EVENT

 Example:
 current time = 4:30 PM

 start = 5:00 PM
 end   = 6:00 PM
========================================================= */

// Creates the default one-hour event starting at the next full hour.
function getDefaultEvent() {
  const now = new Date();

  const startDateTime =
    new Date(now);

  startDateTime.setMinutes(0,0,0);

  startDateTime.setHours(startDateTime.getHours() + 1);

  const endDateTime =
    new Date(startDateTime);

  /*
   * Keep the activity on the same day.
   *
   * Normally default to one hour.
   * If that would cross midnight,
   * use 11:55 PM instead.
   */
  if (
    startDateTime.getHours() >= 23
  ) {
    endDateTime.setHours(23,55,0,0);
  }
  else {
    endDateTime.setHours( endDateTime.getHours() + 1);
  }

  return {
    startDate:
      dateToKey(startDateTime),

    endDate:
      dateToKey(startDateTime),

    startTime:
      hour24ToParts(
        startDateTime.getHours(),
        startDateTime.getMinutes()
      ),

    endTime:
      hour24ToParts(
        endDateTime.getHours(),
        endDateTime.getMinutes()
      ),
  };
}

/* =========================================================
 CREATE REAL DATE-TIME
========================================================= */

// Combines a date key and time parts into a Date object.
function createDateTime(dateKey, timeParts) {
  const [year, month, day,] = dateKey
    .split("-")
    .map(Number);

  return new Date(
    year,
    month - 1,
    day,
    partsToHour24(timeParts),
    Number(timeParts.minute),
    0,
    0
  );
}

/* =========================================================
 CONTROLLED APPLE-STYLE TIME WHEEL

 One mouse-wheel action moves one option.
========================================================= */

// Renders one selectable column in the Apple-style time wheel.
function WheelColumn({ values, selectedValue, onSelect, formatValue, accessibilityLabel, loop = false, }) {
  const { styles, theme } = useThemedStyles(baseStyles);
  const wheelLocked = useRef(false);
  const selectedIndex = Math.max(0, values.indexOf(selectedValue));

  // Moves the wheel selection up or down by one option.
  const moveSelection = (direction) => {
    const currentIndex = Math.max(0, values.indexOf(selectedValue));

    const nextIndex = loop
      ? (currentIndex + direction + values.length) % values.length
      : Math.max(
          0,
          Math.min(values.length - 1, currentIndex + direction)
        );

    if (nextIndex !== currentIndex) {
      onSelect(values[nextIndex]);
    }
  };

  // Handles mouse-wheel movement for the time picker.
  const handleWheel = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (wheelLocked.current) {
      return;
    }

    const deltaY =
      event?.nativeEvent?.deltaY ??
      event?.deltaY ??
      0;

    if (Math.abs(deltaY) < 1) {
      return;
    }

    wheelLocked.current = true;

    moveSelection(
      deltaY > 0
        ? 1
        : -1
    );

    setTimeout(() => {
      wheelLocked.current = false;
    }, 120);
  };

  // Returns a visible wheel row relative to the selected option.
  const getRow = (offset) => {
    const index = loop
      ? (selectedIndex + offset + values.length) % values.length
      : selectedIndex + offset;

    if (index < 0 ||
      index >= values.length) {
      return null;
    }

    return {
      value: values[index],
      index,
    };
  };

  const visibleRows = [
    getRow(-2),
    getRow(-1),
    getRow(0),
    getRow(1),
    getRow(2),
  ];

  if (Platform.OS !== "web") {
    return (
      <Picker
        accessibilityLabel={accessibilityLabel}
        selectedValue={selectedValue}
        onValueChange={onSelect}
        style={styles.wheelColumn}
        itemStyle={{ height: WHEEL_HEIGHT, color: SHADE_ADAPT_GREEN, fontSize: 22 }}
      >
        {values.map(value => (
          <Picker.Item key={String(value)} value={value} label={String(formatValue ? formatValue(value) : value)} />
        ))}
      </Picker>
    );
  }

  return (
    <View style={styles.wheelColumn} onWheel={handleWheel}>
      {visibleRows.map((row, displayIndex) => {
        if (!row) {
          return (
            <View
              key={`empty-${displayIndex}`}
              style={styles.wheelItem}
            />
          );
        }

        const distance = Math.abs(displayIndex - 2);
        const selected = displayIndex === 2;

        let opacity = 1;

        if (distance === 1) {
          opacity = 0.55;
        }

        if (distance === 2) {
          opacity = 0.25;
        }

        return (
          <TouchableOpacity
            key={`${String(row.value)}-${row.index}`}
            activeOpacity={0.7}
            style={styles.wheelItem}
            onPress={() => onSelect(row.value)}
          >
            <Text
              style={[
                styles.wheelItemText,
                { opacity },
                selected && styles.wheelItemTextSelected,
              ]}
            >
              {formatValue
                ? formatValue(row.value)
                : row.value}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* =========================================================
 MAIN SCREEN
========================================================= */

// Renders the Event Planner screen for creating or editing events.
export default function EventPlannerScreen({
  navigation = {
    goBack: () => { },
  },
  route = {
    params: {},
  },
}) {
  const { styles, theme } = useThemedStyles(baseStyles);

  /* =====================================================
   DATE OPTIONS
  ===================================================== */
  // useMemo stores the result of getAllowedDates().
  // The empty dependency array [] means it is calculated once
  // when this screen is first created.
  const dateOptions = useMemo(() => getAllowedDates(), []);

  // map() goes through every date option and extracts only its key.
  // Example result:
  // ["2026-09-14", "2026-09-15", "2026-09-16"]
  const validDateKeys = dateOptions.map((option) => option.key);

  // Get the default event date/time once when the screen opens.
  const defaultEvent = useMemo(() => getDefaultEvent(), []);

  /*
   * If eventId exists:
   * edit existing event.
   *
   * If eventId does not exist:
   * create new event.
   */

  // ?. safely checks route -> params -> eventId.
  // ?? null means use null if eventId does not exist.
  const editingEventId = route?.params?.eventId ?? null;

  /* =====================================================
   INITIAL DATE
  ===================================================== */
  // Get the general date passed from another screen.
  const incomingGeneralDate = route?.params?.date;

  // Use startDate if one was specifically passed in.
  // Otherwise fall back to the general date.
  const incomingStartDate =
    route?.params?.startDate ??
    incomingGeneralDate;

  // Use endDate if one was specifically passed in.
  // Otherwise fall back to the general date.
  const incomingEndDate =
    route?.params?.endDate ??
    incomingGeneralDate;

  // Decide which start date should initially appear.
  const initialStartDate =
    // Check whether the incoming start date is one of the allowed dates.
    validDateKeys.includes(incomingStartDate)
      // If yes, use it.
      ? incomingStartDate
      // Otherwise check whether the default event date is valid.
      : validDateKeys.includes(defaultEvent.startDate)
        // If valid, use the default event date.
        ? defaultEvent.startDate
        // Final fallback: use the first available date.
        : dateOptions[0].key;

  // Decide which end date should initially appear.
  /*
  * Events are restricted to one calendar day,
  * so the initial end date always follows
  * the start date.
  */
  const initialEndDate = initialStartDate;

  /* =====================================================
   INITIAL TIME
  ===================================================== */
  // Convert the incoming start time into the format used by the picker.
  // If no incoming time exists, use the default start time.
  const initialStartTime = useMemo(
    () => parseTimeParam(
      route?.params?.startTime,
      defaultEvent.startTime
    ),

    // Recalculate only if the incoming start time changes.
    [
      route?.params?.startTime,
    ]
  );

  // Convert the incoming end time into the format used by the picker.
  const initialEndTime = useMemo(
    () => parseTimeParam(
      route?.params?.endTime,
      defaultEvent.endTime
    ),
    // Recalculate only if the incoming end time changes.
    [
      route?.params?.endTime,
    ]
  );

  /* =====================================================
   EVENT DETAILS
  ===================================================== */
  // useState stores the title while the user edits the form.
  // title = current value.
  // setTitle() = function used to change it.
  // If editing an event, use its existing title.
  // Otherwise start with an empty string.
  const [title, setTitle,] = useState(
    route?.params?.title ?? ""
  );

  // Store and update the event location.
  const [location, setLocation,] = useState(
    route?.params?.location ?? ""
  );

  // Store and update the optional event description.
  const [description, setDescription,] = useState(
    route?.params?.description ?? ""
  );

  /* =====================================================
   SELECTED LOCATION COORDINATES
  ===================================================== */
  // Store the latitude and longitude of the selected location.
  const [
    selectedLocationCoordinates,
    setSelectedLocationCoordinates,
  ] = useState(
    // Make sure both latitude and longitude are real numbers.
    Number.isFinite(route?.params?.latitude) &&
      Number.isFinite(route?.params?.longitude)
      // If both coordinates are valid, store them.
      ? {
          latitude: route.params.latitude,
          longitude: route.params.longitude,
        }
      // Otherwise no valid location coordinates exist yet.
      : null
  );

  /* =====================================================
   LOCATION AUTOCOMPLETE
  ===================================================== */
  // Stores the list of location suggestions returned by the API.
  const [locationSuggestions, setLocationSuggestions,] = useState([]);

  // Controls whether the loading spinner is shown.
  const [locationSearchLoading, setLocationSearchLoading,] = useState(false);

  // Stores a location-search error message.
  // null means there is currently no error.
  const [locationSearchError, setLocationSearchError,] = useState(null);

  // Tracks whether the user is currently using the location input.
  const [locationFocused, setLocationFocused,] = useState(false);

  // useRef stores a value without causing the screen to re-render.
  // This flag is used to stop an unnecessary search when an existing
  // location is loaded or a suggestion is programmatically selected.
  const suppressLocationSearchRef = useRef(
    Boolean(route?.params?.location)
  );

  /* =====================================================
   DATE/TIME STATE
  ===================================================== */
  // Store the currently selected start date.
  const [startDate, setStartDate,] = useState(initialStartDate);

  // Store the currently selected end date.
  const [endDate, setEndDate,] = useState(initialEndDate);

  // Store the currently selected start time.
  const [startTime, setStartTime,] = useState(initialStartTime);

  // Store the currently selected end time.
  const [endTime, setEndTime,] = useState(initialEndTime);

  /* =====================================================
   ERROR STATE
  ===================================================== */
  // Keep validation errors together in one object.
  // false = no error.
  // true = show the error state for that field.
  const [errors, setErrors,] = useState({
    title: false,
    location: false,
    time: false,
  });

  /* =====================================================
   TIME PICKER
  ===================================================== */
  // false = time picker hidden.
  // true = time picker visible.
  const [timePickerVisible, setTimePickerVisible,] = useState(false);

  // Stores whether the picker is currently editing
  // the "start" time or "end" time.
  const [timePickerTarget, setTimePickerTarget,] = useState("start");

  // Temporary time value shown inside the picker.
  // It is not applied to the event until the user presses Done.
  const [pickerValue, setPickerValue,] = useState(initialStartTime);

  const [timePickerError, setTimePickerError,] = useState("");

  const endPickerInvalid =
    timePickerTarget === "end" &&
    timePartsToMinutes(pickerValue) <=
      timePartsToMinutes(startTime);

  const startPickerInvalid =
    timePickerTarget === "start" &&
    getEndTimeOneHourAfter(
      pickerValue
    ) === null;

  const timePickerInvalid =
    endPickerInvalid ||
    startPickerInvalid;

  /* =====================================================
   DATE PICKER
  ===================================================== */
  // Controls whether the date picker popup is visible.
  const [datePickerVisible, setDatePickerVisible,] = useState(false);

  // Temporary date selected inside the date picker.
  const [datePickerValue, setDatePickerValue,] = useState(initialStartDate);

  /* =====================================================
   LOCATION AUTOCOMPLETE
  ===================================================== */
  // useEffect automatically runs whenever location changes.
  // This is what makes location autocomplete react to user typing.
  useEffect(() => {
    // trim() removes spaces from the start and end.
    const text = location.trim();

    // If the location was set automatically rather than typed by the user,
    // skip this search once.
    if (suppressLocationSearchRef.current) {
      // Reset the flag so future manual changes can search normally.
      suppressLocationSearchRef.current = false;

      // Remove any old suggestions.
      setLocationSuggestions([]);

      // Hide loading state.
      setLocationSearchLoading(false);

      // Clear old search errors.
      setLocationSearchError(null);

      // Stop this useEffect here.
      return;
    }

    // Do not search until the user has entered at least 2 characters.
    if (text.length < 2) {
      // Clear old suggestions.
      setLocationSuggestions([]);

      // Hide the loading spinner.
      setLocationSearchLoading(false);

      // Clear old errors.
      setLocationSearchError(null);

      // Stop before making an API request.
      return;
    }

    // Used to detect whether this particular search has become outdated.
    let cancelled = false;

    // Tell the UI that a location search is starting.
    setLocationSearchLoading(true);

    // Wait 400ms before searching.
    // This prevents an API request being sent after every single keystroke.
    const timeout = setTimeout(async () => {
      // try contains code that may fail, such as an API request.
      try {
        // Clear any previous error before starting a new request.
        setLocationSearchError(null);
        // await waits for the location search request to finish.
        const results = await searchLocations(text);

        // Only update the UI if this search is still relevant.
        if (!cancelled) {
          // Save the returned location suggestions.
          setLocationSuggestions(results);
        }
      }

      // catch runs if searchLocations() throws an error.
      catch (error) {
        // Print the technical error in the browser console.
        console.error(
          "Location search failed:",
          error
        );

        // Only change state if this search was not cancelled.
        if (!cancelled) {
          // Remove old suggestions because the search failed.
          setLocationSuggestions([]);
          // Give the user a readable error message.
          setLocationSearchError(
            "Unable to search locations"
          );
        }
      }
      // finally runs whether the request succeeds or fails.
      finally {
        // If this request is still active, remove the loading state.
        if (!cancelled) {
          setLocationSearchLoading(false);
        }
      }
    // 400 = wait 400 milliseconds.
    }, 400);

    // React runs this cleanup before this effect is replaced
    // or when this component is removed.
    return () => {
      // Mark this request as no longer relevant.
      cancelled = true;

      // Cancel the timeout if it has not executed yet.
      clearTimeout(timeout);
    };

  // [location] means this effect runs when location changes.
  }, [location]);

  /* =====================================================
   TITLE
  ===================================================== */
  // Runs every time the user types in the title field.
  const handleTitleChange = (text) => {
    // Store the new title.
    setTitle(text);

    // Update the error object.
    setErrors((current) => ({
      // Keep all existing error properties.
      ...current,
      // Remove the title error because the user is correcting it.
      title: false,
    }));
  };

  /* =====================================================
   LOCATION
  ===================================================== */
  // Runs whenever the user manually changes the location text.
  const handleLocationChange = (text) => {

    // Update the location shown in the input.
    setLocation(text);

    /*
     * User manually changed the text,
     * so previous coordinates may no longer match.
     */

    // Remove the old latitude/longitude because they might now
    // belong to a different location.
    setSelectedLocationCoordinates(null);
    // Clear the location validation error.
    setErrors((current) => ({
      ...current,
      location: false,
    }));
  };


  /* =====================================================
   SELECT LOCATION SUGGESTION
  ===================================================== */
  // Runs when the user clicks one autocomplete suggestion.
  const handleLocationSuggestionPress = async (suggestion) => {
    // try because getting the coordinates requires an API request.
    try {
      // Show loading state.
      setLocationSearchLoading(true);

      // Clear previous errors.
      setLocationSearchError(null);

      // Get latitude and longitude using the selected Google place ID.
      const coordinates = await getPlaceCoordinates(
        suggestion.placeId
      );

      // Prefer mainText.
      // If mainText does not exist, use label instead.
      const label =
        suggestion.mainText ||
        suggestion.label;

      // The next location update is automatic,
      // so tell useEffect not to search again.
      suppressLocationSearchRef.current = true;

      // Put the selected location name into the form.
      setLocation(label);

      // Save the real latitude and longitude.
      setSelectedLocationCoordinates({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });

      // Remove the suggestion list after selection.
      setLocationSuggestions([]);

      // Close the autocomplete area.
      setLocationFocused(false);

      // Clear the location validation error.
      setErrors((current) => ({
        ...current,
        location: false,
      }));
    }
    // If the place-coordinate request fails.
    catch (error) {
      // Log technical details for debugging.
      console.error(
        "Unable to select location:",
        error
      );

      // Show a readable error to the user.
      setLocationSearchError(
        "Unable to load this location"
      );
    }
    // Always hide the loading state after the operation finishes.
    finally {
      setLocationSearchLoading(false);
    }
  };

  /* =====================================================
   LOCATION SEARCH SUBMIT
  ===================================================== */
  // Runs when the user submits the location field manually.
  const handleLocationSubmit = async () => {
    // Remove spaces around the entered location.
    const text = location.trim();

    // If the location is empty, there is nothing to search.
    if (!text) {
      return;
    }

    try {
      // Turn on loading.
      setLocationSearchLoading(true);
      // Clear previous errors.
      setLocationSearchError(null);

      // Try using the first suggestion we already have.
      let firstSuggestion = locationSuggestions[0];

      // If there is no existing suggestion,
      // perform another location search.
      if (!firstSuggestion) {
        const results = await searchLocations(text);
        firstSuggestion = results[0];
      }

      // If searching still returned no location.
      if (!firstSuggestion) {
        // Clear old results.
        setLocationSuggestions([]);
        // Tell the user that nothing matched.
        setLocationSearchError(
          "No matching locations found"
        );
        // Stop this function.
        return;
      }

      // Reuse the existing selection function instead of duplicating logic.
      await handleLocationSuggestionPress(
        firstSuggestion
      );
    }
    catch (error) {
      console.error(
        "Location submit failed:",
        error
      );
      setLocationSearchError(
        "Unable to search locations"
      );
    }
    finally {
      // Make sure loading is turned off.
      setLocationSearchLoading(false);
    }
  };

  /* =====================================================
   TIME PICKER
  ===================================================== */
  const openTimePicker = (target) => {
    setTimePickerTarget(target);
    setPickerValue(
      target === "start"
        ? {
            ...startTime,
          }
        : {
            ...endTime,
          }
    );
    setTimePickerError("");
    setTimePickerVisible(true);
  };

  // Runs when the user presses Cancel.
  const cancelTimePicker = () => {
    // Hide the popup without applying pickerValue.
    setTimePickerError("");
    setTimePickerVisible(false);
  };

  // Runs when the user presses Done.
  const applyTimePicker = () => {
    /* =====================================================
       END TIME VALIDATION

       If the selected End Time is equal to or earlier than
       Start Time, keep the picker open and do not apply it.
    ===================================================== */

    if (
      timePickerTarget === "end" &&
      endPickerInvalid
    ) {
      // Do not close the picker.
      // The validation message under the wheel stays visible.
      return;
    }


    /* =====================================================
       START TIME

       When Start Time changes, automatically move End Time
       to one hour later.
    ===================================================== */

    if (
      timePickerTarget === "start"
    ) {
      const newStartTime = {
        ...pickerValue,
      };

      const newEndTime =
        getEndTimeOneHourAfter(
          newStartTime
        );

      /*
       * If no valid later End Time can exist on the same day,
       * keep the picker open.
       */
      if (!newEndTime) {
        return;
      }

      setStartTime(
        newStartTime
      );

      setEndTime(
        newEndTime
      );

      setErrors((current) => ({
        ...current,
        time: false,
      }));

      setTimePickerVisible(false);

      return;
    }


    /* =====================================================
       VALID END TIME
    ===================================================== */

    setEndTime({
      ...pickerValue,
    });

    setErrors((current) => ({
      ...current,
      time: false,
    }));

    setTimePickerVisible(false);
  };


  /* =====================================================
   DATE PICKER
  ===================================================== */
  // Opens the single activity-date picker.
  const openDatePicker = () => {
    setDatePickerValue(startDate);

    // Show the date picker.
    setDatePickerVisible(true);
  };

  // Runs when Cancel is pressed.
  const cancelDatePicker = () => {
    // Hide the date picker.
    setDatePickerVisible(false);
  };

  // Runs when Done is pressed.
  const applyDatePicker = () => {
    /*
    * SolAdapt activities must start and end
    * on the same calendar day.
    *
    * Therefore, whichever date the user chooses
    * becomes BOTH the start date and end date.
    */
    setStartDate(datePickerValue);
    setEndDate(datePickerValue);

    setErrors((current) => ({
      ...current,
      time: false,
    }));

    setDatePickerVisible(false);
  };


  /* =====================================================
   SAVE
  ===================================================== */
  // useRef remembers the event after it has been saved.
  // This helps prevent accidentally creating the same event twice.
  const savedEventRef = useRef(null);

  // Stores a human-readable save error.
  const [saveError, setSaveError] = useState("");

  // Validates and saves the new or edited event.
  const handleSave = () => {
    // These variables will hold real JavaScript Date objects.
    let startDateTime;
    let endDateTime;

    // Date conversion can fail, so wrap it in try/catch.
    try {
      // Convert the selected start date and time into
      // a Melbourne timezone ISO value and then into a Date.
      startDateTime = new Date(
        toMelbourneIso(
          startDate,
          partsTo24Hour(startTime)
        )
      );

      // Do the same for the end date/time.
      endDateTime = new Date(
        toMelbourneIso(
          endDate,
          partsTo24Hour(endTime)
        )
      );

      // Clear any previous save error.
      setSaveError("");
    }

    // Runs if date conversion fails.
    catch (error) {
      // Show the error message.
      setSaveError(error.message);
      // Stop saving.
      return;
    }

    // getTime() converts each Date into milliseconds.
    // The event is invalid if end time is equal to or earlier than start time.
    const invalidTime =
      endDateTime.getTime() <=
      startDateTime.getTime();


    // Build an object describing which fields currently have errors.
    const nextErrors = {
      // title.trim() removes spaces.
      // length === 0 means there is no real title.
      title:
        title.trim().length === 0,

      // Location is required too.
      location:
        location.trim().length === 0,

      // Store the time-validation result.
      time:
        invalidTime,
    };

    // Update the UI with the validation results.
    setErrors(nextErrors);

    // If ANY required field has an error...
    if (
      nextErrors.title ||
      nextErrors.location ||
      nextErrors.time
    ) {
      // Stop before saving.
      return;
    }

    // Build the final event object that will be stored.
    const eventDraft = {
      // Remove surrounding spaces before storing.
      title: title.trim(),

      location: location.trim(),

      // ?. safely tries to read latitude.
      // ?? null means use null if there is no coordinate.
      latitude:
        selectedLocationCoordinates?.latitude ??
        null,

      longitude:
        selectedLocationCoordinates?.longitude ??
        null,

      // Description is optional.
      description: description.trim(),

      // Store the raw start date.
      startDate,

      // Also store a user-friendly version.
      startDateDisplay:
        formatFullDate(startDate),

      // Store 24-hour time, e.g. "14:30".
      startTime:
        partsTo24Hour(startTime),

      // Also store display time, e.g. "2:30 PM".
      startTimeDisplay:
        partsToDisplay(startTime),

      endDate,

      endDateDisplay:
        formatFullDate(endDate),

      endTime:
        partsTo24Hour(endTime),

      endTimeDisplay:
        partsToDisplay(endTime),
    };

    // Saving can fail, so use try/catch.
    try {
      // Only save if this screen has not already saved this event.
      if (!savedEventRef.current) {
        // If editingEventId exists, this is an edit.
        // Otherwise, this is a new event.
        savedEventRef.current = editingEventId
        // Update existing event.
        ? updateEvent(
            editingEventId,
            {
              // Copy all newly edited event information.
              ...eventDraft,

              /*
              * The old recommendation was generated
              * using the previous event information.
              *
              * Remove it so a new recommendation
              * will be generated after saving.
              */
              activityRecommendation: null,
            }
          )
        // Create a completely new event.
        : saveEvent(eventDraft);
      }

      // Get the saved event from the ref.
      const savedEvent = savedEventRef.current;

      // If saving returned no event, treat it as an error.
      if (!savedEvent) {
        // Throw moves execution directly to catch().
        throw new Error(
          "The event could not be found on this device."
        );
      }

      // If editing an existing event...
      if (editingEventId) {
        /*
        * Return to Event Details and tell it
        * that a fresh AI recommendation should
        * automatically be shown.
        */
        navigation.popTo(
          "EventDetails",
          {
            eventId: savedEvent.id,

            /*
            * Unique value so Event Details knows
            * this is a new edit/save action.
            */
            recommendationRefreshKey:
              `${Date.now()}`,
          }
        );
      }

      // Otherwise this was a newly created event.
      else {
        /*
        * Return to the existing Heat-Aware Activity Planner
        * and tell it which event needs an automatic
        * recommendation popup.
        */
        navigation.popTo(
          "PlannerTimeline",
          {
            recommendationEventId:
              savedEvent.id,

            /*
            * A unique value ensures a newly saved event
            * triggers the popup exactly once.
            */
            recommendationPopupKey:
              `${Date.now()}`,
          }
        );
      }
    }

    // Runs if saving or navigation throws an error.
    catch (error) {

      // Prefer the real error message.
      // If it does not exist, use a generic fallback.
      setSaveError(
        error.message ||
        "Unable to save this event. Please try again."
      );
    }
  };

  /* =====================================================
   UI
  ===================================================== */

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />

      <View style={styles.mobileContainer}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
        >
          {/* =================================================
              HEADER
          ================================================= */}

          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() =>
                navigation?.goBack?.()
              }
            >
              <Ionicons
                name="chevron-back"
                size={29}
                color={theme.color("#222222")}
              />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              {editingEventId ? "Edit Event" : "New Event"}
            </Text>

            <TouchableOpacity
              style={styles.headerSaveButton}
              onPress={handleSave}
            >
              <Text style={styles.headerSaveText}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          {/* =================================================
              PAGE CONTENT
          ================================================= */}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* =================================================
                EVENT DETAILS
            ================================================= */}

            <Text style={styles.sectionLabel}>
              EVENT DETAILS
            </Text>

            {/* =================================================
                TITLE

                Single-line input = proper vertical centering.
                Long text automatically scrolls horizontally.
            ================================================= */}

            <View
              style={[
                styles.fieldContainer,
                errors.title &&
                  styles.fieldContainerError,
              ]}
            >
              <Text
                style={[
                  styles.textFieldIcon,
                  errors.title &&
                    styles.errorIcon,
                ]}
              >
                Aa
              </Text>

              <TextInput
                value={title}
                onChangeText={handleTitleChange}
                placeholder="Title"
                placeholderTextColor={theme.color("#98989F")}
                multiline={false}
                underlineColorAndroid="transparent"
                style={styles.compactInput}
              />
            </View>

            {/* =================================================
                LOCATION + AUTOCOMPLETE
            ================================================= */}

            <View style={styles.locationSearchWrapper}>
              <View
                style={[
                  styles.fieldContainer,
                  errors.location &&
                    styles.fieldContainerError,
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={25}
                  color={theme.color(errors.location
                      ? ERROR_RED
                      : "#77777D")}
                  style={styles.inputIcon}
                />

                <TextInput
                  value={location}
                  onChangeText={handleLocationChange}
                  onFocus={() =>
                    setLocationFocused(true)
                  }
                  placeholder="Location"
                  placeholderTextColor={theme.color("#98989F")}
                  multiline={false}
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={handleLocationSubmit}
                  underlineColorAndroid="transparent"
                  style={styles.compactInput}
                />

                {locationSearchLoading && (
                  <ActivityIndicator
                    size="small"
                    color={theme.color(SHADE_ADAPT_GREEN)}
                  />
                )}
              </View>

              {/* LOCATION DROPDOWN */}

              {locationFocused &&
                location.trim().length >= 2 && (
                  <View style={styles.locationDropdown}>
                    {/* LOADING */}

                    {locationSearchLoading && (
                      <View style={styles.locationMessageRow}>
                        <ActivityIndicator
                          size="small"
                          color={theme.color(SHADE_ADAPT_GREEN)}
                        />

                        <Text style={styles.locationMessageText}>
                          Searching...
                        </Text>
                      </View>
                    )}

                    {/* ERROR */}

                    {!locationSearchLoading &&
                      locationSearchError && (
                        <View style={styles.locationMessageRow}>
                          <Text style={styles.locationErrorText}>
                            {locationSearchError}
                          </Text>
                        </View>
                      )}

                    {/* RESULTS */}

                    {!locationSearchLoading &&
                      !locationSearchError &&
                      locationSuggestions.map(
                        (suggestion) => (
                          <TouchableOpacity
                            key={suggestion.placeId}
                            style={styles.locationSuggestionRow}
                            activeOpacity={0.7}
                            onPress={() =>
                              handleLocationSuggestionPress(
                                suggestion
                              )
                            }
                          >
                            <Ionicons
                              name="location-outline"
                              size={21}
                              color={theme.color("#555555")}
                            />

                            <View style={styles.locationSuggestionText}>
                              <Text
                                style={styles.locationSuggestionMain}
                                numberOfLines={1}
                              >
                                {suggestion.mainText ||
                                  suggestion.label}
                              </Text>

                              {!!suggestion.secondaryText && (
                                <Text
                                  style={styles.locationSuggestionSecondary}
                                  numberOfLines={1}
                                >
                                  {suggestion.secondaryText}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        )
                      )}

                    {/* NO RESULTS */}

                    {!locationSearchLoading &&
                      !locationSearchError &&
                      locationSuggestions.length === 0 && (
                        <View style={styles.locationMessageRow}>
                          <Text style={styles.locationMessageText}>
                            No matching locations found
                          </Text>
                        </View>
                      )}
                  </View>
                )}
            </View>

            {/* REQUIRED ERROR */}

            {(errors.title ||
              errors.location) && (
                <Text style={styles.errorMessage}>
                  Please enter the required fields highlighted in red.
                </Text>
              )}

            {/* =================================================
                DATE & TIME
            ================================================= */}

            <Text style={styles.sectionLabel}>
              DATE & TIME
            </Text>

            <View style={styles.dateTimeCard}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Date, ${formatDatePill(startDate)}`}
                style={[styles.dateControl, styles.dateTimeDivider]}
                onPress={openDatePicker}
              >
                <View style={styles.controlLabelRow}>
                  <Ionicons name="calendar-outline" size={21} color={theme.color("#173C31")} />
                  <Text style={styles.controlLabel}>Date</Text>
                </View>
                <Text style={styles.controlValue}>{formatDatePill(startDate)}</Text>
                <Ionicons name="chevron-down" size={18} color={theme.color("#52645E")} />
              </TouchableOpacity>

              <View style={styles.timePair}>
                <View style={styles.timeColumn}>
                  <Text style={styles.controlLabel}>Starts</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.timePill}
                    onPress={() => openTimePicker("start")}
                  >
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={theme.color("#173C31")}
                    />

                    <Text style={styles.timePillText}>
                      {partsToDisplay(startTime)}
                    </Text>

                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={theme.color("#52645E")}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.timeColumn}>
                  <Text style={styles.controlLabel}>
                    Ends
                  </Text>

                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[
                      styles.timePill,
                      errors.time &&
                        styles.errorPill,
                    ]}
                    onPress={() =>
                      openTimePicker("end")
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={theme.color(
                        errors.time
                          ? ERROR_RED
                          : "#173C31"
                      )}
                    />

                    <Text
                      style={[
                        styles.timePillText,
                        errors.time &&
                          styles.errorTimeText,
                      ]}
                    >
                      {partsToDisplay(endTime)}
                    </Text>

                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={theme.color(
                        errors.time
                          ? ERROR_RED
                          : "#52645E"
                      )}
                    />
                  </TouchableOpacity>

                  {errors.time && (
                    <Text style={styles.endTimeError}>
                      End time must be later than start time.
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <Text style={styles.helperText}>
              Select the date and time for your activity.
            </Text>

            {/* =================================================
                DESCRIPTION
            ================================================= */}

            <Text style={styles.sectionLabel}>
              EVENT DESCRIPTION
            </Text>

            <View style={styles.descriptionContainer}>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Add notes about your activity..."
                placeholderTextColor={theme.color("#98989F")}
                multiline
                scrollEnabled
                textAlignVertical="top"
                underlineColorAndroid="transparent"
                style={styles.descriptionInput}
              />
            </View>

            {/* =================================================
                SAVE
            ================================================= */}

            <TouchableOpacity
              style={styles.primarySaveButton}
              onPress={handleSave}
            >
              <Ionicons
                name="checkmark"
                size={23}
                color={theme.color("#FFFFFF")}
              />

              <Text style={styles.primarySaveText}>
                Save Event
              </Text>
            </TouchableOpacity>

            <Text style={styles.saveHint}>
              Heat and UV advice will be shown after the event is submitted.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* =====================================================
          TIME PICKER
      ===================================================== */}

      <Modal
        visible={timePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelTimePicker}
      >
        <View style={styles.modalOuter}>
          <View style={styles.modalMobileContainer}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={cancelTimePicker}
            />

            <View style={styles.timeSheet}>
              {/* HEADER */}

              <View style={styles.pickerHeader}>
                <TouchableOpacity
                  style={styles.sheetButton}
                  onPress={cancelTimePicker}
                >
                  <Text style={styles.cancelText}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <View style={styles.sheetTitleContainer}>
                  <Text style={styles.sheetTitle}>
                    {timePickerTarget === "start"
                      ? "Start Time"
                      : "End Time"}
                  </Text>

                  <Text style={styles.sheetSubTitle}>
                    {partsToDisplay(pickerValue)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.sheetButton}
                  onPress={applyTimePicker}
                >
                  <Text style={styles.doneText}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>

              {/* LABELS */}

              <View style={styles.wheelLabels}>
                <Text style={styles.wheelLabel}>
                  Hour
                </Text>

                <Text style={styles.wheelLabel}>
                  Minute
                </Text>

                <Text style={styles.wheelLabel}>
                  AM / PM
                </Text>
              </View>

              {/* WHEEL */}

              <View style={styles.wheelArea}>
                {Platform.OS === "web" && <View
                  pointerEvents="none"
                  style={styles.wheelSelectionBar}
                />}

                <View style={styles.wheelColumns}>
                  <WheelColumn
                    values={HOURS}
                    accessibilityLabel="Hour"
                    loop
                    selectedValue={
                      pickerValue.hour
                    }
                    onSelect={(hour) => {
                      setPickerValue({
                        ...pickerValue,
                        hour,
                      });
                      setTimePickerError("");
                    }}
                  />

                  <WheelColumn
                    values={MINUTES}
                    accessibilityLabel="Minute"
                    loop
                    selectedValue={
                      pickerValue.minute
                    }
                    formatValue={pad2}
                    onSelect={(minute) => {
                      setPickerValue({
                        ...pickerValue,
                        minute,
                      });
                      setTimePickerError("");
                    }}
                  />

                  <WheelColumn
                    values={PERIODS}
                    accessibilityLabel="AM or PM"
                    selectedValue={
                      pickerValue.period
                    }
                    onSelect={(period) => {
                      setPickerValue({
                        ...pickerValue,
                        period,
                      });
                    }}
                  />
                </View>
              </View>

              {endPickerInvalid && (
                <Text
                  accessibilityRole="alert"
                  style={styles.timePickerError}
                >
                  End time must be later than start time.
                </Text>
              )}

            {startPickerInvalid && (
              <Text
                accessibilityRole="alert"
                style={styles.timePickerError}
              >
                Start time must leave time for the activity to end today.
              </Text>
            )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(saveError)}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveError("")}
      >
        <View style={styles.modalOuter}>
          <View style={styles.modalMobileContainer}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setSaveError("")}
            />

            <View
              accessibilityViewIsModal
              style={styles.saveErrorDialog}
            >
              <Text
                accessibilityRole="header"
                style={styles.saveErrorTitle}
              >
                {saveError.startsWith("This time overlaps")
                  ? "Time conflict"
                  : "Unable to save event"}
              </Text>

              <Text
                accessibilityRole="alert"
                style={styles.saveErrorText}
              >
                {saveError}
              </Text>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={saveError.startsWith("This time overlaps") ? "Choose another time" : "OK"}
                style={styles.saveErrorButton}
                onPress={() => setSaveError("")}
              >
                <Text style={styles.saveErrorButtonText}>
                  {saveError.startsWith("This time overlaps") ? "Choose another time" : "OK"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =====================================================
          DATE PICKER
      ===================================================== */}

      <Modal
        visible={datePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelDatePicker}
      >
        <View style={styles.modalOuter}>
          <View style={styles.modalMobileContainer}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={cancelDatePicker}
            />

            <View style={styles.dateSheet}>
              {/* HEADER */}

              <View style={styles.pickerHeader}>
                <TouchableOpacity
                  style={styles.sheetButton}
                  onPress={cancelDatePicker}
                >
                  <Text style={styles.cancelText}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <View style={styles.sheetTitleContainer}>
                  <Text style={styles.sheetTitle}>
                    Activity Date
                  </Text>

                  <Text style={styles.sheetSubTitle}>
                    {formatDatePill(datePickerValue)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.sheetButton}
                  onPress={applyDatePicker}
                >
                  <Text style={styles.doneText}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>

              {/* OPTIONS */}

              <View style={styles.dateOptionsContainer}>
                {dateOptions.map((option, index) => {
                  const selected =
                    option.key ===
                    datePickerValue;

                  return (
                    <TouchableOpacity
                      key={option.key}
                      activeOpacity={0.7}
                      style={[
                        styles.dateOptionRow,

                        index <
                          dateOptions.length - 1 &&
                          styles.dateOptionDivider,

                        selected &&
                          styles.dateOptionSelected,
                      ]}
                      onPress={() =>
                        setDatePickerValue(
                          option.key
                        )
                      }
                    >
                      <View style={styles.dateOptionTextContainer}>
                        <Text
                          style={[
                            styles.dateOptionLabel,
                            selected &&
                              styles.dateOptionLabelSelected,
                          ]}
                        >
                          {option.label}
                        </Text>

                        <Text style={styles.dateOptionFull}>
                          {option.fullDate}
                        </Text>
                      </View>

                      {selected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={25}
                          color={theme.color(SHADE_ADAPT_GREEN)}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* =========================================================
 STYLES
========================================================= */

const baseStyles = StyleSheet.create({
  /* =====================================================
   SCREEN
  ===================================================== */

  safeArea: {
    flex: 1,
    alignItems: "center",
    backgroundColor: PAGE_BACKGROUND,
  },

  mobileContainer: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#F5F8F6",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    overflow: "hidden",
  },

  keyboardAvoidingView: {
    flex: 1,
  },

  /* =====================================================
   HEADER
  ===================================================== */

  header: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    backgroundColor: "#F5F8F6",
    borderBottomWidth: 1,
    borderBottomColor: "#E1E9E5",
  },

  backButton: {
    width: 55,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
    cursor: "pointer",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: "#173C31",
  },

  headerSaveButton: {
    width: 55,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
    cursor: "pointer",
  },

  headerSaveText: {
    fontSize: 16,
    fontWeight: "700",
    color: SHADE_ADAPT_GREEN,
  },

  /* =====================================================
   PAGE CONTENT
  ===================================================== */

  scrollView: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 42,
  },

  sectionLabel: {
    marginLeft: 4,
    marginTop: 8,
    marginBottom: 9,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: "#61746B",
  },

  /* =====================================================
   TITLE / LOCATION CARD
  ===================================================== */

  fieldContainer: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 14,
    backgroundColor: WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E0E9E4",
    shadowColor: "#173C31",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },

  fieldContainerError: {
    borderColor: ERROR_RED,
    backgroundColor: "#FFF9F7",
  },

  textFieldIcon: {
    width: 28,
    fontSize: 23,
    lineHeight: 28,
    color: "#77777D",
    textAlign: "center",
  },

  errorIcon: {
    color: ERROR_RED,
  },

  inputIcon: {
    width: 28,
    textAlign: "center",
  },

  /* =====================================================
   IMPORTANT FIX

   Single-line input.
   This keeps text vertically centred.

   Long text scrolls horizontally automatically.
  ===================================================== */

  compactInput: {
    flex: 1,
    height: 56,
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 17,
    lineHeight: 22,
    color: "#222222",
    outlineStyle: "none",
  },

  errorMessage: {
    marginTop: 1,
    marginLeft: 4,
    marginBottom: 13,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    color: ERROR_RED,
  },

  /* =====================================================
   LOCATION AUTOCOMPLETE
  ===================================================== */

  locationSearchWrapper: {
    position: "relative",
    zIndex: 30,
  },

  locationDropdown: {
    marginTop: -3,
    marginBottom: 10,
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: WHITE,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 50,
  },

  locationSuggestionRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    cursor: "pointer",
  },

  locationSuggestionText: {
    flex: 1,
    marginLeft: 12,
  },

  locationSuggestionMain: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222222",
  },

  locationSuggestionSecondary: {
    marginTop: 3,
    fontSize: 13,
    color: "#666666",
  },

  locationMessageRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  locationMessageText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#666666",
  },

  locationErrorText: {
    fontSize: 14,
    color: ERROR_RED,
  },

  /* =====================================================
   DATE & TIME
  ===================================================== */

  dateTimeCard: {
    overflow: "hidden",
    backgroundColor: WHITE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E9E4",
    shadowColor: "#173C31",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },

  dateTimeCardError: {
    borderColor: ERROR_RED,
    backgroundColor: "#FFF9F7",
  },

  dateControl: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  dateTimeDivider: {
    borderBottomWidth: 1,
    borderBottomColor: IOS_SEPARATOR,
  },

  controlLabelRow: {
    width: 94,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  controlLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#173C31",
  },

  controlValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#222222",
  },

  timePair: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },

  timeColumn: {
    flex: 1,
    gap: 8,
  },

  timePill: {
    minHeight: 48,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7FAF8",
    borderWidth: 1,
    borderColor: "#DCE5E0",
    cursor: "pointer",
  },

  timePillText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#222222",
  },

  errorPill: {
    backgroundColor: "#FCE7E3",
  },

  errorTimeText: {
    color: ERROR_RED,
  },

  helperText: {
    marginTop: 7,
    marginLeft: 4,
    marginBottom: 18,
    fontSize: 13,
    lineHeight: 18,
    color: IOS_SECONDARY_TEXT,
  },

  timeErrorMessage: {
    marginTop: 7,
    marginLeft: 4,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    color: ERROR_RED,
  },

  /* =====================================================
   DESCRIPTION
  ===================================================== */

  descriptionContainer: {
    height: 150,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: "#E0E9E4",
    shadowColor: "#173C31",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },

  descriptionInput: {
    flex: 1,
    height: 130,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
    lineHeight: 23,
    color: "#222222",
    overflowY: "auto",
    outlineStyle: "none",
  },

  /* =====================================================
   SAVE
  ===================================================== */

  primarySaveButton: {
    minHeight: 54,
    marginTop: 24,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SHADE_ADAPT_GREEN,
    shadowColor: "#173C31",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
    cursor: "pointer",
  },

  primarySaveText: {
    marginLeft: 8,
    fontSize: 17,
    fontWeight: "700",
    color: WHITE,
  },

  saveHint: {
    marginTop: 10,
    paddingHorizontal: 8,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    color: IOS_SECONDARY_TEXT,
  },

  /* =====================================================
   MODALS
  ===================================================== */

  modalOuter: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.08)",
  },

  modalMobileContainer: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    paddingHorizontal: 18,
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },

  /* =====================================================
   PICKER HEADER
  ===================================================== */

  pickerHeader: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    backgroundColor: IOS_BACKGROUND,
    borderBottomWidth: 1,
    borderBottomColor: IOS_SEPARATOR,
  },

  sheetButton: {
    width: 65,
    minHeight: 44,
    justifyContent: "center",
    cursor: "pointer",
  },

  cancelText: {
    fontSize: 16,
    color: IOS_SECONDARY_TEXT,
  },

  doneText: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
    color: SHADE_ADAPT_GREEN,
  },

  sheetTitleContainer: {
    alignItems: "center",
    justifyContent: "center",
  },

  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#171717",
  },

  sheetSubTitle: {
    marginTop: 3,
    fontSize: 14,
    color: IOS_SECONDARY_TEXT,
  },

  /* =====================================================
   TIME PICKER
  ===================================================== */

  timeSheet: {
    width: "100%",
    maxWidth: 394,
    backgroundColor: IOS_BACKGROUND,
    borderRadius: 24,
    overflow: "hidden",
    paddingBottom: 18,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },

  timePickerError: {
    paddingHorizontal: 18,
    paddingTop: 12,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    color: ERROR_RED,
  },

  saveErrorDialog: {
    width: "100%",
    maxWidth: 340,
    padding: 22,
    borderRadius: 18,
    backgroundColor: WHITE,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },

  saveErrorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#171717",
  },

  saveErrorText: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 23,
    color: IOS_SECONDARY_TEXT,
  },

  saveErrorButton: {
    minHeight: 48,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: SHADE_ADAPT_GREEN,
    cursor: "pointer",
  },

  saveErrorButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: WHITE,
  },

  wheelLabels: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: IOS_BACKGROUND,
  },

  wheelLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: IOS_SECONDARY_TEXT,
  },

  wheelArea: {
    height: WHEEL_HEIGHT,
    position: "relative",
    overflow: "hidden",
    backgroundColor: WHITE,
  },

  wheelSelectionBar: {
    position: "absolute",
    left: 12,
    right: 12,
    top: (WHEEL_HEIGHT - WHEEL_ITEM_HEIGHT) / 2,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: 12,
    backgroundColor: "#F1F1F3",
    zIndex: 0,
  },

  wheelColumns: {
    flex: 1,
    flexDirection: "row",
    zIndex: 1,
  },

  wheelColumn: {
    flex: 1,
    height: WHEEL_HEIGHT,
    cursor: "ns-resize",
  },

  wheelItem: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },

  wheelItemText: {
    fontSize: 22,
    fontWeight: "400",
    color: "#333333",
  },

  wheelItemTextSelected: {
    fontSize: 26,
    fontWeight: "500",
    opacity: 1,
    color: "#171717",
  },

  /* =====================================================
   DATE PICKER
  ===================================================== */

  dateSheet: {
    width: "100%",
    maxWidth: 394,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: IOS_BACKGROUND,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },

  dateOptionsContainer: {
    margin: 18,
    overflow: "hidden",
    borderRadius: 15,
    backgroundColor: WHITE,
  },

  dateOptionRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    cursor: "pointer",
  },

  dateOptionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: IOS_SEPARATOR,
  },

  dateOptionSelected: {
    backgroundColor: "#EDF5F2",
  },

  dateOptionTextContainer: {
    flex: 1,
    paddingRight: 12,
  },

  dateOptionLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#222222",
  },

  dateOptionLabelSelected: {
    color: SHADE_ADAPT_GREEN,
  },

  dateOptionFull: {
    marginTop: 4,
    fontSize: 13,
    color: IOS_SECONDARY_TEXT,
  },
  endTimeError: {
  marginTop: 6,
  fontSize: 12,
  lineHeight: 16,
  color: ERROR_RED,
},
});