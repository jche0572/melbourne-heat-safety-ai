// Import the backend API base URL.
import { API_BASE_URL } from "../config/api";
import { Platform } from "react-native";
import { reverseGeocodeAsync } from "expo-location";


// Search for location suggestions from user input.
export async function searchLocations(input) {

  // Remove spaces from the start and end of the input.
  const searchText = input?.trim();

  // If input is empty, return an empty list.
  if (!searchText) {
    return [];
  }

  // Build the autocomplete API URL.
  const url =
    `${API_BASE_URL}/api/places/autocomplete` +
    `?input=${encodeURIComponent(searchText)}`;

  // Send request and wait for the backend response.
  const response = await fetch(url);

  // If the request failed, throw an error.
  if (!response.ok) {
    throw new Error("Failed to search locations");
  }

  // Convert the response JSON into JavaScript data.
  const data = await response.json();

  // Return suggestions, or an empty array if none exist.
  return data.suggestions ?? [];
}


// Get latitude and longitude from a place ID.
export async function getPlaceCoordinates(placeId) {

  // Stop if no place ID was provided.
  if (!placeId) {
    throw new Error("placeId is required");
  }

  // Build the place details API URL.
  const url =
    `${API_BASE_URL}/api/places/details` +
    `?placeId=${encodeURIComponent(placeId)}`;

  // Send request and wait for the response.
  const response = await fetch(url);

  // Throw an error if the request failed.
  if (!response.ok) {
    throw new Error("Failed to get place coordinates");
  }

  // Convert JSON response into JavaScript data.
  const data = await response.json();

  // Return latitude and longitude as numbers.
  return {
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
  };
}


// Convert latitude and longitude into a suburb name.
export async function getSuburbFromCoordinates(
  latitude,
  longitude
) {

  // Check that both coordinates are valid numbers.
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {

    // Use a fallback label if coordinates are invalid.
    return "Current location";
  }

  if (Platform.OS !== "web") {
    try {
      const [address] = await reverseGeocodeAsync({ latitude, longitude });
      const name = address?.district || address?.city || address?.subregion || address?.region;
      if (name) return name;
    } catch {
      // Use the existing backend when the device geocoder is unavailable.
    }
  }

  // Build the reverse-geocoding API URL.
  const url =
    `${API_BASE_URL}/api/places/reverse-geocode` +
    `?lat=${encodeURIComponent(latitude)}` +
    `&lng=${encodeURIComponent(longitude)}`;

  // Send request and wait for the backend response.
  const response = await fetch(url);

  // Throw an error if the request failed.
  if (!response.ok) {
    throw new Error(
      "Failed to get suburb"
    );
  }

  // Convert the JSON response into JavaScript data.
  const data = await response.json();

  // Return the suburb if available.
  // Otherwise use "Current location".
  return (
    data.suburb ||
    "Current location"
  );
}
