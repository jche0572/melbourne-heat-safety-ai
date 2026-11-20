import os
import sys
from datetime import datetime
from pathlib import Path

import psycopg


# Allow imports from project root for local manual execution
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(PROJECT_ROOT))


SCHEMA_VERSION = 1


def parse_event_number(value, field_name):
    """Validate a numeric value received from the fetch Lambda."""

    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
    ):
        raise ValueError(
            f"{field_name} must be a number."
        )

    if value != value or value in (
        float("inf"),
        float("-inf"),
    ):
        raise ValueError(
            f"{field_name} must be finite."
        )

    return float(value)


def parse_event_datetime(value, field_name):
    """Validate and convert an ISO-8601 timestamp."""

    if not isinstance(value, str):
        raise ValueError(
            f"{field_name} must be an ISO-8601 string."
        )

    try:
        parsed = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )
    except ValueError as error:
        raise ValueError(
            f"{field_name} must be a valid ISO-8601 timestamp."
        ) from error

    if (
        parsed.tzinfo is None
        or parsed.utcoffset() is None
    ):
        raise ValueError(
            f"{field_name} must include a timezone."
        )

    return parsed


def deserialize_record(record):
    """Validate and deserialize one forecast record."""

    if not isinstance(record, dict):
        raise ValueError(
            "Each forecast record must be an object."
        )

    forecast_time = parse_event_datetime(
        record.get("forecast_time"),
        "forecast_time",
    )

    fetched_at = parse_event_datetime(
        record.get("fetched_at"),
        "fetched_at",
    )

    latitude = parse_event_number(
        record.get("latitude"),
        "latitude",
    )

    longitude = parse_event_number(
        record.get("longitude"),
        "longitude",
    )

    temperature_c = parse_event_number(
        record.get("temperature_c"),
        "temperature_c",
    )

    relative_humidity = parse_event_number(
        record.get("relative_humidity"),
        "relative_humidity",
    )

    wind_speed_10m_ms = parse_event_number(
        record.get("wind_speed_10m_ms"),
        "wind_speed_10m_ms",
    )

    shortwave_radiation_wm2 = parse_event_number(
        record.get("shortwave_radiation_wm2"),
        "shortwave_radiation_wm2",
    )

    apparent_temperature_c = parse_event_number(
        record.get("apparent_temperature_c"),
        "apparent_temperature_c",
    )

    uv_index = parse_event_number(
        record.get("uv_index"),
        "uv_index",
    )


    # ---------------------------------------------------------
    # Range validation
    # ---------------------------------------------------------

    if not -90 <= latitude <= 90:
        raise ValueError(
            "latitude must be between -90 and 90."
        )

    if not -180 <= longitude <= 180:
        raise ValueError(
            "longitude must be between -180 and 180."
        )

    if not 0 <= relative_humidity <= 100:
        raise ValueError(
            "relative_humidity must be between 0 and 100."
        )

    if wind_speed_10m_ms < 0:
        raise ValueError(
            "wind_speed_10m_ms must not be negative."
        )

    if shortwave_radiation_wm2 < 0:
        raise ValueError(
            "shortwave_radiation_wm2 must not be negative."
        )

    if uv_index < 0:
        raise ValueError(
            "uv_index must not be negative."
        )


    # ---------------------------------------------------------
    # Text fields
    # ---------------------------------------------------------

    timezone_name = record.get("timezone")

    if (
        not isinstance(timezone_name, str)
        or not timezone_name.strip()
    ):
        raise ValueError(
            "timezone must be a non-empty string."
        )

    source = record.get("source")

    if (
        not isinstance(source, str)
        or not source.strip()
    ):
        raise ValueError(
            "source must be a non-empty string."
        )


    return {
        "forecast_time": forecast_time,
        "latitude": latitude,
        "longitude": longitude,

        "temperature_c": temperature_c,

        "relative_humidity":
            relative_humidity,

        "wind_speed_10m_ms":
            wind_speed_10m_ms,

        "shortwave_radiation_wm2":
            shortwave_radiation_wm2,

        "apparent_temperature_c":
            apparent_temperature_c,

        "uv_index": uv_index,

        "timezone": timezone_name,
        "fetched_at": fetched_at,
        "source": source,
    }


def deserialize_records(event):
    """Validate the fetch-Lambda payload."""

    if not isinstance(event, dict):
        raise ValueError(
            "Hourly forecast ingestion event must be an object."
        )

    if event.get("schema_version") != SCHEMA_VERSION:
        raise ValueError(
            "Unsupported hourly forecast payload schema version."
        )

    records = event.get("records")

    if not isinstance(records, list):
        raise ValueError(
            "Hourly forecast ingestion records must be a list."
        )

    return [
        deserialize_record(record)
        for record in records
    ]


def load_hourly_forecast_to_database(records):
    """
    Upsert validated hourly forecast records into PostgreSQL.
    """

    if not records:
        print("No forecast records to load.")
        return 0

    print(
        f"Preparing to load {len(records)} forecast records..."
    )


    # ---------------------------------------------------------
    # Database connection details
    # ---------------------------------------------------------

    db_host = os.environ.get("DB_HOST")
    db_port = os.environ.get(
        "DB_PORT",
        "5432",
    )
    db_name = os.environ.get("DB_NAME")
    db_user = os.environ.get("DB_USER")
    db_password = os.environ.get(
        "DB_PASSWORD"
    )

    if not all([
        db_host,
        db_name,
        db_user,
        db_password,
    ]):
        raise ValueError(
            "Missing database environment variables."
        )


    # ---------------------------------------------------------
    # Connect to PostgreSQL / AWS RDS
    # ---------------------------------------------------------

    with psycopg.connect(
        host=db_host,
        port=db_port,
        dbname=db_name,
        user=db_user,
        password=db_password,
        sslmode="require",
    ) as connection:

        print(
            "PostgreSQL database connection established."
        )

        with connection.cursor() as cursor:

            for record in records:

                cursor.execute(
                    """
                    INSERT INTO hourly_forecast (
                        forecast_time,
                        latitude,
                        longitude,

                        temperature_c,
                        relative_humidity,
                        wind_speed_10m_ms,
                        shortwave_radiation_wm2,

                        apparent_temperature_c,
                        uv_index,

                        timezone,
                        fetched_at,
                        source
                    )
                    VALUES (
                        %(forecast_time)s,
                        %(latitude)s,
                        %(longitude)s,

                        %(temperature_c)s,
                        %(relative_humidity)s,
                        %(wind_speed_10m_ms)s,
                        %(shortwave_radiation_wm2)s,

                        %(apparent_temperature_c)s,
                        %(uv_index)s,

                        %(timezone)s,
                        %(fetched_at)s,
                        %(source)s
                    )
                    ON CONFLICT (
                        forecast_time,
                        latitude,
                        longitude
                    )
                    DO UPDATE SET

                        temperature_c =
                            EXCLUDED.temperature_c,

                        relative_humidity =
                            EXCLUDED.relative_humidity,

                        wind_speed_10m_ms =
                            EXCLUDED.wind_speed_10m_ms,

                        shortwave_radiation_wm2 =
                            EXCLUDED.shortwave_radiation_wm2,

                        apparent_temperature_c =
                            EXCLUDED.apparent_temperature_c,

                        uv_index =
                            EXCLUDED.uv_index,

                        timezone =
                            EXCLUDED.timezone,

                        fetched_at =
                            EXCLUDED.fetched_at,

                        source =
                            EXCLUDED.source;
                    """,
                    record,
                )


    print(
        f"Successfully loaded/upserted "
        f"{len(records)} hourly forecast records."
    )

    return len(records)


def lambda_handler(event, context):
    """
    AWS Lambda entry point.

    Receives validated forecast records from the
    hourly forecast fetch Lambda and writes them to RDS.
    """

    try:
        records = deserialize_records(event)

        count = load_hourly_forecast_to_database(
            records
        )

        return {
            "statusCode": 200,
            "body": (
                "Hourly forecast ingestion completed successfully. "
                f"{count} records processed."
            ),
        }

    except Exception as error:
        print(
            f"Hourly forecast ingestion failed: {error}"
        )

        raise


if __name__ == "__main__":
    # Local/manual development only.
    # Lambda does NOT execute this section.

    from data.validation_hourly_forecast import (
        get_validated_forecast_data,
    )

    local_records = (
        get_validated_forecast_data()
    )

    load_hourly_forecast_to_database(
        local_records
    )