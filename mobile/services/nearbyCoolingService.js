import { API_BASE_URL } from "../config/api";

export async function getNearbyFountains(latitude, longitude) {
  const url =
    `${API_BASE_URL}/api/fountains/nearby` +
    `?lat=${latitude}&lng=${longitude}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to get nearby fountains");
  }

  return response.json();
}

export async function getWalkingRoute(
  originLat,
  originLng,
  destLat,
  destLng
) {
  const url =
    `${API_BASE_URL}/api/route` +
    `?originLat=${originLat}` +
    `&originLng=${originLng}` +
    `&destLat=${destLat}` +
    `&destLng=${destLng}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to calculate walking route");
  }

  return response.json();
}

export async function getNearbyShade(latitude, longitude) {
  const url =
    `${API_BASE_URL}/api/shade/nearby` +
    `?lat=${latitude}&lng=${longitude}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to get nearby shade areas");
  }

  return response.json();
}
