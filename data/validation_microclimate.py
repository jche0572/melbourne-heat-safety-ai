import os
import requests

from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / "server" / ".env"

load_dotenv(ENV_FILE)

API_URL = os.environ.get("MICROCLIMATE_API_URL")


def parse_float(value):
    """Convert source value to float while allowing missing values."""

    if value is None or value == "":
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_timestamp(value):
    """Parse ISO-8601 timestamp."""

    if not value:
        return None

    try:
        timestamp = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )

        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(
                tzinfo=timezone.utc
            )

        return timestamp

    except ValueError:
        return None


def validate_record(record):
    """Validate one City of Melbourne microclimate record."""

    device_id = record.get("device_id")

    received_at = parse_timestamp(
        record.get("received_at")
    )

    sensor_location = record.get(
        "sensorlocation"
    )

    latlong = record.get("latlong") or {}

    latitude = parse_float(
        latlong.get("lat")
    )

    longitude = parse_float(
        latlong.get("lon")
    )

    # Required fields
    if not device_id:
        return None

    if received_at is None:
        return None

    if latitude is None or longitude is None:
        return None

    # Valid geographic coordinates
    if not (-90 <= latitude <= 90):
        return None

    if not (-180 <= longitude <= 180):
        return None

    air_temperature = parse_float(
        record.get("airtemperature")
    )

    relative_humidity = parse_float(
        record.get("relativehumidity")
    )

    # Humidity must be between 0 and 100
    if (
        relative_humidity is not None
        and not 0 <= relative_humidity <= 100
    ):
        relative_humidity = None

    return {
        "device_id": device_id,
        "received_at": received_at,
        "sensor_location": sensor_location,

        "latitude": latitude,
        "longitude": longitude,

        "air_temperature": air_temperature,
        "relative_humidity": relative_humidity,
    }

def get_validated_microclimate_data():
    """
    Fetch recent microclimate observations.

    Recent data intentionally overlaps between runs.
    PostgreSQL keeps one latest row per device_id.
    Newer observations update the existing sensor row,
    while same or older observations are ignored.
    """

    if not API_URL:
        raise ValueError(
            "MICROCLIMATE_API_URL is not configured."
        )

    cutoff = (
        datetime.now(timezone.utc)
        - timedelta(minutes=60)
    )

    validated_records = []

    offset = 0
    page_size = 100

    while True:

        print("Starting City of Melbourne microclimate API request.")

        response = requests.get(
            API_URL,
            params={
                "order_by": "received_at DESC",
                "limit": page_size,
                "offset": offset,
            },
            timeout=20,
        )

        print("City of Melbourne microclimate API response received.")

        response.raise_for_status()

        data = response.json()

        records = data.get("results", [])

        if not records:
            break

        reached_old_data = False

        for record in records:

            validated = validate_record(
                record
            )

            if validated is None:
                continue

            if (
                validated["received_at"]
                < cutoff
            ):
                reached_old_data = True
                continue

            validated_records.append(
                validated
            )

        if reached_old_data:
            break

        if len(records) < page_size:
            break

        offset += page_size

    return validated_records


if __name__ == "__main__":

    records = (
        get_validated_microclimate_data()
    )

    print(
        f"Validated records: {len(records)}"
    )

    for record in records[:5]:
        print(record)
