import csv
import os
from pathlib import Path

import psycopg


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE_FILE = PROJECT_ROOT / "data" / "drinking_fountains_prepared.csv"


def load_drinking_fountains():
    """Load the prepared drinking fountain dataset into PostgreSQL/PostGIS."""

    if not SOURCE_FILE.exists():
        raise FileNotFoundError(
            f"Prepared drinking fountain dataset not found: {SOURCE_FILE}"
        )

    db_host = os.environ.get("DB_HOST")
    db_name = os.environ.get("DB_NAME")
    db_user = os.environ.get("DB_USER")
    db_password = os.environ.get("DB_PASSWORD")
    db_port = os.environ.get("DB_PORT", "5432")

    if not all([db_host, db_name, db_user, db_password]):
        raise ValueError(
            "Missing database environment variables. "
            "Set DB_HOST, DB_NAME, DB_USER and DB_PASSWORD."
        )

    with open(SOURCE_FILE, "r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        rows = list(reader)

    if not rows:
        raise ValueError("Prepared drinking fountain dataset is empty.")

    with psycopg.connect(
        host=db_host,
        dbname=db_name,
        user=db_user,
        password=db_password,
        port=db_port,
        sslmode="require",
    ) as connection:
        with connection.cursor() as cursor:
            for row in rows:
                cursor.execute(
                    """
                    INSERT INTO drinking_fountains (
                        asset_id,
                        facility_type,
                        location_description,
                        latitude,
                        longitude,
                        location
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        ST_SetSRID(ST_MakePoint(%s, %s), 4326)
                    )
                    ON CONFLICT (asset_id)
                    DO UPDATE SET
                        facility_type = EXCLUDED.facility_type,
                        location_description = EXCLUDED.location_description,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        location = EXCLUDED.location;
                    """,
                    (
                        int(row["asset_id"]),
                        row["facility_type"],
                        row["location_description"],
                        float(row["latitude"]),
                        float(row["longitude"]),
                        float(row["longitude"]),
                        float(row["latitude"]),
                    ),
                )

    print(f"Drinking fountain import completed: {len(rows)} records processed.")


if __name__ == "__main__":
    load_drinking_fountains()