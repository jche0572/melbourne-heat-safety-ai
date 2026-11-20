import requests
from datetime import datetime
from zoneinfo import ZoneInfo


FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

PARAMS = {
    "latitude": -37.814,
    "longitude": 144.9633,
    "hourly": (
        "temperature_2m,"
        "relative_humidity_2m,"
        "wind_speed_10m,"
        "shortwave_radiation,"
        "apparent_temperature,"
        "uv_index"
    ),
    "wind_speed_unit": "ms",
    "timezone": "Australia/Sydney",
    "forecast_days": 3,
}


def get_validated_forecast_data():
    """
    Fetch and validate 3-day hourly forecast data from Open-Meteo.
    Returns a list of validated hourly forecast records.
    """

    # 1. FETCH JSON DATA
    response = requests.get(FORECAST_URL, params=PARAMS, timeout=15)
    response.raise_for_status()

    data = response.json()

    # 2. CHECK REQUIRED TOP-LEVEL FIELDS
    required_top_level = ["latitude", "longitude", "timezone", "hourly"]

    for field in required_top_level:
        if field not in data:
            raise ValueError(f"Missing required field: {field}")

    latitude = data["latitude"]
    longitude = data["longitude"]
    timezone_name = data["timezone"]

    # 3. BASIC LOCATION VALIDATION
    if not (-39 <= latitude <= -37):
        raise ValueError(f"Unexpected latitude: {latitude}")

    if not (144 <= longitude <= 146):
        raise ValueError(f"Unexpected longitude: {longitude}")

    # 4. CHECK REQUIRED HOURLY FIELDS
    hourly = data["hourly"]

    required_hourly = [
        "time",
        "temperature_2m",
        "relative_humidity_2m",
        "wind_speed_10m",
        "shortwave_radiation",
        "apparent_temperature",
        "uv_index",
    ]

    for field in required_hourly:
        if field not in hourly:
            raise ValueError(f"Missing hourly field: {field}")

    times = hourly["time"]
    temperatures = hourly["temperature_2m"]
    relative_humidities = hourly["relative_humidity_2m"]
    wind_speeds = hourly["wind_speed_10m"]
    shortwave_radiations = hourly["shortwave_radiation"]
    apparent_temperatures = hourly["apparent_temperature"]
    uv_indexes = hourly["uv_index"]

    # 5. CHECK ARRAY LENGTHS MATCH
    lengths = {
        len(times),
        len(temperatures),
        len(relative_humidities),
        len(wind_speeds),
        len(shortwave_radiations),
        len(apparent_temperatures),
        len(uv_indexes),
    }

    if len(lengths) != 1:
        raise ValueError("Hourly forecast arrays have different lengths.")

    if len(times) == 0:
        raise ValueError("No hourly forecast records returned.")

    # 6. PREPARE TIMEZONE + FETCH TIME
    local_timezone = ZoneInfo(timezone_name)
    fetched_at = datetime.now(local_timezone)

    validated_records = []

    # 7. VALIDATE EACH HOURLY RECORD
    for i in range(len(times)):
        forecast_time_raw = times[i]
        temperature = temperatures[i]
        relative_humidity = relative_humidities[i]
        wind_speed = wind_speeds[i]
        shortwave_radiation = shortwave_radiations[i]
        apparent_temperature = apparent_temperatures[i]
        uv_index = uv_indexes[i]

        if temperature is None:
            raise ValueError(
                f"Missing temperature at {forecast_time_raw}"
            )

        if relative_humidity is None:
            raise ValueError(
                f"Missing relative humidity at {forecast_time_raw}"
            )

        if wind_speed is None:
            raise ValueError(
                f"Missing wind speed at {forecast_time_raw}"
            )

        if shortwave_radiation is None:
            raise ValueError(
                f"Missing shortwave radiation at {forecast_time_raw}"
            )

        if apparent_temperature is None:
            raise ValueError(
                f"Missing apparent temperature at {forecast_time_raw}"
            )

        if uv_index is None:
            raise ValueError(
                f"Missing UV index at {forecast_time_raw}"
            )

        if not isinstance(temperature, (int, float)):
            raise ValueError(
                f"Invalid temperature at {forecast_time_raw}"
            )

        if not isinstance(
            relative_humidity,
            (int, float),
        ):
            raise ValueError(
                f"Invalid relative humidity at {forecast_time_raw}"
            )

        if not isinstance(
            wind_speed,
            (int, float),
        ):
            raise ValueError(
                f"Invalid wind speed at {forecast_time_raw}"
            )

        if not isinstance(
            shortwave_radiation,
            (int, float),
        ):
            raise ValueError(
                f"Invalid shortwave radiation at {forecast_time_raw}"
            )

        if not isinstance(apparent_temperature, (int, float)):
            raise ValueError(
                f"Invalid apparent temperature at {forecast_time_raw}"
            )

        if not isinstance(uv_index, (int, float)):
            raise ValueError(
                f"Invalid UV index at {forecast_time_raw}"
            )

        if uv_index < 0:
            raise ValueError(
                f"UV index cannot be negative at {forecast_time_raw}"
            )

        if not 0 <= relative_humidity <= 100:
            raise ValueError(
                f"Relative humidity out of range at {forecast_time_raw}"
            )

        if wind_speed < 0:
            raise ValueError(
                f"Wind speed cannot be negative at {forecast_time_raw}"
            )

        if shortwave_radiation < 0:
            raise ValueError(
                f"Shortwave radiation cannot be negative at {forecast_time_raw}"
            )

        # Convert Open-Meteo local timestamp to timezone-aware datetime
        forecast_time = datetime.fromisoformat(
            forecast_time_raw
        ).replace(tzinfo=local_timezone)

        validated_records.append(
            {
                "forecast_time": forecast_time,
                "latitude": latitude,
                "longitude": longitude,
                "temperature_c": temperature,
                "relative_humidity": relative_humidity,
                "wind_speed_10m_ms": wind_speed,
                "shortwave_radiation_wm2": shortwave_radiation,
                "apparent_temperature_c": apparent_temperature,
                "uv_index": uv_index,
                "timezone": timezone_name,
                "fetched_at": fetched_at,
                "source": "Open-Meteo",
            }
        )

    return validated_records


if __name__ == "__main__":
    records = get_validated_forecast_data()

    print(f"Validated {len(records)} hourly forecast records.")
    print()

    # Show first 5 records for testing
    for record in records[:5]:
        print(record)