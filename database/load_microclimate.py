import os
import sys

from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

import psycopg


PROJECT_ROOT = (
    Path(__file__).resolve().parent.parent
)

ENV_FILE = PROJECT_ROOT / "server" / ".env"

load_dotenv(ENV_FILE)

sys.path.append(str(PROJECT_ROOT))


SCHEMA_VERSION = 1


def parse_event_number(value, field_name, allow_none=False):
    """Validate a JSON number received from the fetch Lambda."""

    if value is None and allow_none:
        return None

    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
    ):
        raise ValueError(
            f"{field_name} must be a number."
        )

    if value != value or value in (float("inf"), float("-inf")):
        raise ValueError(
            f"{field_name} must be finite."
        )

    return float(value)


def deserialize_record(record):
    """Validate and deserialize one normalized ingestion record."""

    if not isinstance(record, dict):
        raise ValueError(
            "Each microclimate record must be an object."
        )

    device_id = record.get("device_id")

    if not isinstance(device_id, str) or not device_id.strip():
        raise ValueError(
            "device_id must be a non-empty string."
        )

    received_at_raw = record.get("received_at")

    if not isinstance(received_at_raw, str):
        raise ValueError(
            "received_at must be an ISO-8601 string."
        )

    try:
        received_at = datetime.fromisoformat(
            received_at_raw.replace("Z", "+00:00")
        )
    except ValueError as error:
        raise ValueError(
            "received_at must be a valid ISO-8601 timestamp."
        ) from error

    if (
        received_at.tzinfo is None
        or received_at.utcoffset() is None
    ):
        raise ValueError(
            "received_at must include a timezone."
        )

    received_at = received_at.astimezone(
        timezone.utc
    )

    sensor_location = record.get("sensor_location")

    if (
        sensor_location is not None
        and not isinstance(sensor_location, str)
    ):
        raise ValueError(
            "sensor_location must be a string or null."
        )

    latitude = parse_event_number(
        record.get("latitude"),
        "latitude",
    )

    longitude = parse_event_number(
        record.get("longitude"),
        "longitude",
    )

    if not -90 <= latitude <= 90:
        raise ValueError(
            "latitude must be between -90 and 90."
        )

    if not -180 <= longitude <= 180:
        raise ValueError(
            "longitude must be between -180 and 180."
        )

    air_temperature = parse_event_number(
        record.get("air_temperature"),
        "air_temperature",
        allow_none=True,
    )

    relative_humidity = parse_event_number(
        record.get("relative_humidity"),
        "relative_humidity",
        allow_none=True,
    )

    if (
        relative_humidity is not None
        and not 0 <= relative_humidity <= 100
    ):
        raise ValueError(
            "relative_humidity must be between 0 and 100."
        )

    return {
        "device_id": device_id,
        "received_at": received_at,
        "sensor_location": sensor_location,
        "latitude": latitude,
        "longitude": longitude,
        "air_temperature": air_temperature,
        "relative_humidity": relative_humidity,
    }


def deserialize_records(event):
    """Validate the invocation envelope and deserialize its records."""

    if not isinstance(event, dict):
        raise ValueError(
            "Microclimate ingestion event must be an object."
        )

    if event.get("schema_version") != SCHEMA_VERSION:
        raise ValueError(
            "Unsupported microclimate payload schema version."
        )

    records = event.get("records")

    if not isinstance(records, list):
        raise ValueError(
            "Microclimate ingestion event records must be a list."
        )

    return [
        deserialize_record(record)
        for record in records
    ]


def load_microclimate_to_database(records):

    if not records:
        print(
            "No valid microclimate observations found."
        )
        return

    db_host = os.environ.get("DB_HOST")
    db_name = os.environ.get("DB_NAME")
    db_user = os.environ.get("DB_USER")
    db_password = os.environ.get(
        "DB_PASSWORD"
    )
    db_port = os.environ.get(
        "DB_PORT",
        "5432"
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

    inserted_or_updated = 0
    skipped = 0

    print("Starting PostgreSQL database connection.")

    with psycopg.connect(
        host=db_host,
        dbname=db_name,
        user=db_user,
        password=db_password,
        port=db_port,
        sslmode="require",
    ) as connection:

        print("PostgreSQL database connection established.")

        with connection.cursor() as cursor:

            for record in records:

                cursor.execute(
                    """
                    INSERT INTO microclimate_observations (
                        device_id,
                        received_at,
                        sensor_location,

                        latitude,
                        longitude,
                        location,

                        air_temperature,
                        relative_humidity
                    )

                    VALUES (
                        %s,
                        %s,
                        %s,

                        %s,
                        %s,

                        ST_SetSRID(
                            ST_MakePoint(%s, %s),
                            4326
                        ),

                        %s,
                        %s
                    )

                    ON CONFLICT (device_id)
                    DO UPDATE SET
                        received_at = EXCLUDED.received_at,
                        sensor_location = EXCLUDED.sensor_location,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        location = EXCLUDED.location,
                        air_temperature = EXCLUDED.air_temperature,
                        relative_humidity = EXCLUDED.relative_humidity

                    WHERE
                        EXCLUDED.received_at >
                        microclimate_observations.received_at;
                    """,

                    (
                        record["device_id"],
                        record["received_at"],
                        record["sensor_location"],

                        record["latitude"],
                        record["longitude"],

                        # PostGIS point order:
                        # longitude first, latitude second
                        record["longitude"],
                        record["latitude"],

                        record["air_temperature"],
                        record["relative_humidity"],
                    ),
                )

                if cursor.rowcount == 1:
                    inserted_or_updated += 1
                else:
                    skipped += 1

    print(
        "Microclimate ingestion finished."
    )

    print(
        f"Source records processed: "
        f"{len(records)}"
    )

    print(
        f"Inserted or updated: "
        f"{inserted_or_updated}"
    )

    print(
        f"Same or older readings skipped: "
        f"{skipped}"
    )


def lambda_handler(event, context):

    try:

        records = deserialize_records(event)

        load_microclimate_to_database(records)

        return {
            "statusCode": 200,
            "body":
                "Microclimate ingestion completed successfully.",
        }

    except Exception as error:

        print(
            f"Microclimate ingestion failed: "
            f"{error}"
        )

        raise


if __name__ == "__main__":

    from data.validation_microclimate import (
        get_validated_microclimate_data,
    )

    load_microclimate_to_database(
        get_validated_microclimate_data()
    )
