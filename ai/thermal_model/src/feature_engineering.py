"""Leakage-safe feature sets for the population thermal-sensation model.

V5 uses the Steadman apparent-temperature approximation in degrees Celsius:
``AT = T + 0.33 * e - 4``, where
``e = RH / 100 * 6.105 * exp(17.27 * T / (237.7 + T))`` in hPa.
The omitted ``-0.70 * wind_speed`` term assumes still air (0 m/s). The feature
is therefore an experimental temperature/humidity-derived indicator, not a
medical heat-risk measure.
"""

from __future__ import annotations

import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler

RAW_FEATURES = ("temperature_c", "relative_humidity")
FEATURE_SETS = ("V1", "V2", "V3", "V4", "V5")
FEATURE_NAMES = {
    "V1": RAW_FEATURES,
    "V2": RAW_FEATURES,
    "V3": (*RAW_FEATURES, "temperature_c_squared", "relative_humidity_squared"),
    "V4": (
        *RAW_FEATURES,
        "temperature_c_squared",
        "relative_humidity_squared",
        "temperature_x_humidity",
    ),
    "V5": (
        *RAW_FEATURES,
        "temperature_c_squared",
        "relative_humidity_squared",
        "temperature_x_humidity",
        "apparent_temperature_c",
    ),
}


def apparent_temperature_c(temperature_c, relative_humidity):
    """Return still-air Steadman apparent temperature from Celsius and RH %."""
    temperature = np.asarray(temperature_c, dtype=float)
    humidity = np.asarray(relative_humidity, dtype=float)
    if not np.isfinite(temperature).all() or not np.isfinite(humidity).all():
        raise ValueError("Temperature and relative humidity must be finite")
    if ((humidity < 0) | (humidity > 100)).any():
        raise ValueError("Relative humidity must be between 0 and 100 percent")
    vapour_pressure = humidity / 100 * 6.105 * np.exp(
        17.27 * temperature / (237.7 + temperature)
    )
    return temperature + 0.33 * vapour_pressure - 4.0


def _weather_array(values):
    array = np.asarray(values, dtype=float)
    if array.ndim != 2 or array.shape[1] != 2:
        raise ValueError(f"Expected the two raw weather features, got shape {array.shape}")
    if not np.isfinite(array).all():
        raise ValueError("Weather features must be finite")
    return array


def _v3(values):
    weather = _weather_array(values)
    return np.column_stack((weather, weather[:, 0] ** 2, weather[:, 1] ** 2))


def _v4(values):
    weather = _weather_array(values)
    return np.column_stack((_v3(weather), weather[:, 0] * weather[:, 1]))


def _v5(values):
    weather = _weather_array(values)
    apparent = apparent_temperature_c(weather[:, 0], weather[:, 1])
    return np.column_stack((_v4(weather), apparent))


def _v3_names(_, input_features):
    return np.asarray([*input_features, "temperature_c_squared", "relative_humidity_squared"])


def _v4_names(transformer, input_features):
    return np.append(_v3_names(transformer, input_features), "temperature_x_humidity")


def _v5_names(transformer, input_features):
    return np.append(_v4_names(transformer, input_features), "apparent_temperature_c")


def build_feature_transformer(feature_set: str) -> Pipeline:
    """Build V1-V5 preprocessing; fitted steps remain inside the CV pipeline."""
    version = feature_set.upper()
    if version not in FEATURE_SETS:
        raise ValueError(f"Unknown feature set {feature_set!r}; expected one of {FEATURE_SETS}")

    steps = [
        (
            "select_weather",
            ColumnTransformer(
                [("weather", "passthrough", list(RAW_FEATURES))],
                remainder="drop",
                verbose_feature_names_out=False,
            ),
        )
    ]
    if version in {"V3", "V4", "V5"}:
        transform, names = {
            "V3": (_v3, _v3_names),
            "V4": (_v4, _v4_names),
            "V5": (_v5, _v5_names),
        }[version]
        steps.append(
            ("engineer", FunctionTransformer(transform, feature_names_out=names, validate=False))
        )
    if version != "V1":
        steps.append(("scale", StandardScaler()))
    return Pipeline(steps)


make_feature_transformer = build_feature_transformer


def make_feature_pipeline(feature_set: str, estimator) -> Pipeline:
    """Combine preprocessing and an estimator for fold-local CV fitting."""
    return Pipeline([("features", build_feature_transformer(feature_set)), ("model", estimator)])
