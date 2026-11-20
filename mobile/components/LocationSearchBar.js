import { useThemedStyles } from "../theme/useAppTheme";
import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import {
  searchLocations,
  getPlaceCoordinates,
} from "../services/locationSearchService";

export default function LocationSearchBar({
  onLocationSelected,
  onCurrentLocationPress,
  onClear,
}) {
  const { styles, theme } = useThemedStyles(baseStyles);
  const inputRef = useRef(null);

  // Prevent a new autocomplete search from running
  // immediately after a suggestion has been selected.
  const suppressNextSearchRef = useRef(false);

  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [searchError, setSearchError] =
    useState(null);

  const [isFocused, setIsFocused] =
    useState(false);

  const [hasEdited, setHasEdited] =
    useState(false);

  useEffect(() => {
    const text = searchText.trim();

    // A selected location updates the text field.
    // Do not search Google again for that update.
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;

      setSuggestions([]);
      setSearchLoading(false);
      setSearchError(null);

      return;
    }

    if (text.length < 2) {
      setSuggestions([]);
      setSearchError(null);
      setSearchLoading(false);

      return;
    }

    let cancelled = false;

    setSearchLoading(true);

    const timeout = setTimeout(async () => {
      try {
        setSearchError(null);

        const results =
          await searchLocations(text);

        if (!cancelled) {
          setSuggestions(results);
        }
      } catch (error) {
        console.error(
          "Location search failed:",
          error
        );

        if (!cancelled) {
          setSuggestions([]);

          setSearchError(
            "Unable to search locations"
          );
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchText]);

  const closeSearch = () => {
    setIsFocused(false);
    setSuggestions([]);

    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  const handleSuggestionPress = async (
    suggestion
  ) => {
    try {
      setSearchLoading(true);
      setSearchError(null);

      const coordinates =
        await getPlaceCoordinates(
          suggestion.placeId
        );

      const selectedLocation = {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,

        label:
          suggestion.mainText ||
          suggestion.label,
      };

      // Prevent useEffect from searching this
      // selected label again.
      suppressNextSearchRef.current = true;

      setSearchText(selectedLocation.label);
      setSuggestions([]);

      closeSearch();

      onLocationSelected?.(
        selectedLocation
      );
    } catch (error) {
      console.error(
        "Could not select location:",
        error
      );

      setSearchError(
        "Unable to load this location"
      );
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchSubmit = async () => {
    const text = searchText.trim();

    if (!text) {
      closeSearch();
      return;
    }

    try {
      setSearchLoading(true);
      setSearchError(null);

      // If autocomplete results already exist,
      // use the first one.
      let firstSuggestion =
        suggestions[0];

      // If the user pressed Search before
      // suggestions finished loading, search now.
      if (!firstSuggestion) {
        const results =
          await searchLocations(text);

        firstSuggestion =
          results[0];
      }

      if (!firstSuggestion) {
        setSuggestions([]);

        setSearchError(
          "No matching locations found"
        );

        return;
      }

      await handleSuggestionPress(
        firstSuggestion
      );
    } catch (error) {
      console.error(
        "Location search submit failed:",
        error
      );

      setSearchError(
        "Unable to search locations"
      );
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCurrentLocationPress = () => {
    closeSearch();

    onCurrentLocationPress?.();
  };

  const handleClear = () => {
    setSearchText("");
    setSuggestions([]);
    setSearchError(null);

    // Tell the parent screen that the
    // search field was cleared.
    onClear?.();

    inputRef.current?.focus();
  };

  // Dropdown only stays open while the
  // user is actively using the search field.
  // Show the dropdown only while the input is focused
  // and there is some text in the search field.
  const showDropdown =
    isFocused &&
    (!hasEdited || searchText.trim().length > 0);

  return (
    <View style={styles.wrapper}>

      {/* SEARCH BAR */}
      <View style={styles.searchBar}>
        <Ionicons
          name="search-outline"
          size={21}
          color={theme.color("#555555")}
        />

        <TextInput
          ref={inputRef}
          style={styles.input}
          value={searchText}
          onChangeText={(text) => {
            setHasEdited(true);
            setSearchText(text);

            // Tell the parent screen if the field
            // has been completely cleared.
            if (text.trim() === "") {
              onClear?.();
            }
          }}

          placeholder="Search location"
          placeholderTextColor={theme.color("#777777")}

          onFocus={() => {
            setIsFocused(true);
            setHasEdited(false);
          }}

          autoCorrect={false}

          returnKeyType="search"

          // User presses Search on keyboard
          onSubmitEditing={
            handleSearchSubmit
          }

          blurOnSubmit={false}
        />

        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
          >
            <Ionicons
              name="close-circle"
              size={21}
              color={theme.color("#777777")}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* SUGGESTION DROPDOWN */}
      {showDropdown && (
        <View style={styles.dropdown}>

          {/* CURRENT LOCATION */}
          <TouchableOpacity
            style={
              styles.currentLocationRow
            }
            activeOpacity={0.7}
            onPress={
              handleCurrentLocationPress
            }
          >
            <View
              style={
                styles.currentLocationIcon
              }
            >
              <Ionicons
                name="navigate"
                size={20}
                color={theme.color("#39775F")}
              />
            </View>

            <Text
              style={
                styles.currentLocationText
              }
            >
              Current Location
            </Text>
          </TouchableOpacity>

          {/* LOADING */}
          {searchLoading && (
            <View style={styles.messageRow}>
              <ActivityIndicator
                size="small"
              />

              <Text
                style={styles.messageText}
              >
                Searching...
              </Text>
            </View>
          )}

          {/* ERROR */}
          {!searchLoading &&
            searchError && (
              <View
                style={styles.messageRow}
              >
                <Text
                  style={styles.errorText}
                >
                  {searchError}
                </Text>
              </View>
            )}

          {/* SUGGESTIONS */}
          {!searchLoading &&
            suggestions.map(
              (suggestion) => (
                <TouchableOpacity
                  key={
                    suggestion.placeId
                  }
                  style={
                    styles.suggestionRow
                  }
                  activeOpacity={0.7}

                  onPress={() =>
                    handleSuggestionPress(
                      suggestion
                    )
                  }
                >
                  <Ionicons
                    name="location-outline"
                    size={21}
                    color={theme.color("#555555")}
                  />

                  <View
                    style={
                      styles.suggestionText
                    }
                  >
                    <Text
                      style={
                        styles.mainText
                      }
                      numberOfLines={1}
                    >
                      {suggestion.mainText ||
                        suggestion.label}
                    </Text>

                    {!!suggestion.secondaryText && (
                      <Text
                        style={
                          styles.secondaryText
                        }
                        numberOfLines={1}
                      >
                        {
                          suggestion.secondaryText
                        }
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )
            )}

          {/* NO RESULTS */}
          {!searchLoading &&
            searchText.trim().length >= 2 &&
            suggestions.length === 0 &&
            !searchError && (
              <View
                style={styles.messageRow}
              >
                <Text
                  style={styles.messageText}
                >
                  No matching locations found
                </Text>
              </View>
            )}

        </View>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  wrapper: {
    width: "100%",
    zIndex: 20,
  },

  searchBar: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,

    shadowColor: "#000000",

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },

  input: {
    flex: 1,

    /*
    * Space between the input field and the
    * search / clear icons.
    */
    marginHorizontal: 10,

    fontSize: 16,
    color: "#222222",

    /*
    * Vertical space keeps the input comfortably tall.
    */
    paddingVertical: 12,

    /*
    * Add internal horizontal spacing so the typed text
    * does not sit directly against the input's edge,
    * especially when the field is focused on web.
    */
    paddingHorizontal: 8,
  },

  dropdown: {
    marginTop: 6,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",

    shadowColor: "#000000",

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 5,
  },

  currentLocationRow: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,

    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },

  currentLocationIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E4EFDA",
    alignItems: "center",
    justifyContent: "center",
  },

  currentLocationText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#39775F",
  },

  suggestionRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,

    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },

  suggestionText: {
    flex: 1,
    marginLeft: 12,
  },

  mainText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222222",
  },

  secondaryText: {
    marginTop: 3,
    fontSize: 13,
    color: "#666666",
  },

  messageRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  messageText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#666666",
  },

  errorText: {
    fontSize: 14,
    color: "#B3261E",
  },
});
