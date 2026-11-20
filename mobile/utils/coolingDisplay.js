const STREET_SUFFIXES = {
  Street: "St",
  Road: "Rd",
  Avenue: "Ave",
  Boulevard: "Blvd",
  Place: "Pl",
  Parade: "Pde",
  Lane: "Ln",
  Drive: "Dr",
};

function shortenStreetNames(value) {
  return value.replace(
    /\b(Street|Road|Avenue|Boulevard|Place|Parade|Lane|Drive)\b/gi,
    (suffix) => STREET_SUFFIXES[
      suffix.charAt(0).toUpperCase() + suffix.slice(1).toLowerCase()
    ]
  );
}

export function formatCoolingLocation(description) {
  if (typeof description !== "string") return "";

  const location = description
    .trim()
    .replace(/,\s*approximately\b[\s\S]*$/i, "")
    .replace(/,\s*[A-Z][A-Z ]+\s+VIC\s+\d{2,4}\s*$/i, "")
    .trim();

  if (!location) return "";

  const between = location.match(/^(.+?)\s+between\s+(.+?)\s+and\s+(.+)$/i);
  if (between) {
    return `${shortenStreetNames(between[1])}, near ${shortenStreetNames(between[2])}`;
  }

  const intersection = location.match(/^Intersection of\s+(.+?)\s+and\s+(.+)$/i);
  if (intersection) {
    return `${shortenStreetNames(intersection[1])} & ${shortenStreetNames(intersection[2])}`;
  }

  const from = location.match(/^(.+?)\s+from\s+(.+)$/i);
  if (from) {
    return `${shortenStreetNames(from[1])}, near ${shortenStreetNames(from[2])}`;
  }

  return shortenStreetNames(location.split(",")[0].trim());
}

export function getCoolingDisplay(option, type) {
  const facilityType =
    typeof option?.facility_type === "string"
      ? option.facility_type.trim()
      : "";

  return {
    name:
      type === "shade"
        ? "Tree shade area"
        : facilityType || "Drinking fountain",
    location: formatCoolingLocation(option?.location_description),
  };
}
