import os
import sys
from pathlib import Path

import psycopg

# Allow imports from the project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(PROJECT_ROOT))

from data.validation_uv import get_validated_uv_data


def load_uv_to_database():
    """Fetch validated Melbourne UV data and store it in PostgreSQL."""

    # 1. Get validated live UV data
    uv_data = get_validated_uv_data()

    # Do not store an unavailable observation
    if (
        uv_data["status"] is None
        or uv_data["status"].lower() != "ok"
        or uv_data["uv_index"] is None
        or uv_data["observed_at_utc"] is None
    ):
        print("Current UV observation is unavailable. Nothing inserted.")
        return

    # 2. Read database connection details from environment variables
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

    # 3. Connect to PostgreSQL
    with psycopg.connect(
        host=db_host,
        dbname=db_name,
        user=db_user,
        password=db_password,
        port=db_port,
        sslmode="require",
    ) as connection:

        # 4. Insert the observation
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO uv_observations
                    (station_name, uv_index, observed_at_utc, status)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (station_name, observed_at_utc)
                DO NOTHING;
                """,
                (
                    uv_data["station_name"],
                    uv_data["uv_index"],
                    uv_data["observed_at_utc"],
                    uv_data["status"],
                ),
            )

            if cursor.rowcount == 1:
                print("UV observation inserted successfully.")
            else:
                print("UV observation already exists. Nothing inserted.")

    print("UV data:")
    for key, value in uv_data.items():
        print(f"{key}: {value}")

def lambda_handler(event, context):
    try:
        load_uv_to_database()

        return {
            "statusCode": 200,
            "body": "UV ingestion completed successfully."
        }

    except Exception as error:
        print(f"UV ingestion failed: {error}")
        raise

if __name__ == "__main__":
    load_uv_to_database()
