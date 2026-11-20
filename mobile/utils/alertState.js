export const ALERT_STATES = Object.freeze({
  NORMAL: "NORMAL",
  HEAT_HIGH: "HEAT_HIGH",
  UV_HIGH: "UV_HIGH",
  HEAT_AND_UV_HIGH: "HEAT_AND_UV_HIGH",
  DATA_UNAVAILABLE: "DATA_UNAVAILABLE",
});

export const ALERT_THRESHOLDS = Object.freeze({
  // DEVELOPMENT/DEMO ONLY: the team must validate an authoritative heat
  // threshold and calculation method before this is used in production.
  heatCelsius: 35,

  // UV Index 3 is the configurable point at which sun protection is required.
  uvIndex: 3,
});

function isAvailable(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function getAlertState(
  temperature,
  uvIndex,
  thresholds = ALERT_THRESHOLDS,
) {
  const temperatureAvailable = isAvailable(temperature);
  const uvAvailable = isAvailable(uvIndex);

  if (!temperatureAvailable && !uvAvailable) {
    return {
      state: ALERT_STATES.DATA_UNAVAILABLE,
      temperatureAvailable,
      uvAvailable,
      heatHigh: false,
      uvHigh: false,
    };
  }

  const heatHigh =
    temperatureAvailable && temperature >= thresholds.heatCelsius;
  const uvHigh = uvAvailable && uvIndex >= thresholds.uvIndex;

  let state = ALERT_STATES.NORMAL;

  if (heatHigh && uvHigh) {
    state = ALERT_STATES.HEAT_AND_UV_HIGH;
  } else if (heatHigh) {
    state = ALERT_STATES.HEAT_HIGH;
  } else if (uvHigh) {
    state = ALERT_STATES.UV_HIGH;
  }

  return {
    state,
    temperatureAvailable,
    uvAvailable,
    heatHigh,
    uvHigh,
  };
}

export function getUvCategory(uvIndex) {
  if (!isAvailable(uvIndex)) return "Unavailable";
  if (uvIndex < 3) return "Low";
  if (uvIndex < 6) return "Moderate";
  if (uvIndex < 8) return "High";
  if (uvIndex < 11) return "Very High";
  return "Extreme";
}

export function getAlertContent(alertResult) {
  const { state, temperatureAvailable, uvAvailable } = alertResult;

  if (state === ALERT_STATES.HEAT_AND_UV_HIGH) {
    return {
      title: "High heat & UV",
      description: "Consider reducing time in direct sunlight.",
      unavailableMessage: null,
      isRiskAlert: true,
    };
  }

  if (state === ALERT_STATES.HEAT_HIGH) {
    return {
      title: "High heat",
      description: "Consider reducing time in direct sunlight.",
      unavailableMessage: uvAvailable ? null : "UV information is unavailable.",
      isRiskAlert: true,
    };
  }

  if (state === ALERT_STATES.UV_HIGH) {
    return {
      title: "High UV",
      description: "Sun protection recommended.",
      unavailableMessage: temperatureAvailable
        ? null
        : "Heat information is unavailable.",
      isRiskAlert: true,
    };
  }

  if (state === ALERT_STATES.DATA_UNAVAILABLE) {
    return {
      title: "Heat & UV data unavailable",
      description: "Environmental conditions cannot be determined right now.",
      unavailableMessage: null,
      isRiskAlert: false,
    };
  }

  if (!temperatureAvailable) {
    return {
      title: "Heat data unavailable",
      description: "UV information is available and below the alert threshold.",
      unavailableMessage: null,
      isRiskAlert: false,
    };
  }

  if (!uvAvailable) {
    return {
      title: "UV data unavailable",
      description: "Heat information is available and below the alert threshold.",
      unavailableMessage: null,
      isRiskAlert: false,
    };
  }

  return {
    title: "No heat or UV alert",
    description: "Current heat and UV levels are below the alert thresholds.",
    unavailableMessage: null,
    isRiskAlert: false,
  };
}
