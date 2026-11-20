import json
import boto3

from data.validation_hourly_forecast import (
    get_validated_forecast_data
)


SCHEMA_VERSION = 1

# AWS SDK client used to invoke the writer Lambda.
lambda_client = boto3.client("lambda")


def lambda_handler(event, context):
    """
    Fetch and validate Open-Meteo hourly forecast data,
    then send the validated records to the RDS writer Lambda.
    """

    try:
        # Fetch and validate the hourly forecast.
        records = get_validated_forecast_data()

        print(f"Validated hourly forecast records: {len(records)}")

        if not records:
            return {
                "statusCode": 200,
                "body": "No valid hourly forecast records found."
            }

        # Convert records into JSON-compatible values.
        serializable_records = []

        for record in records:
            converted_record = record.copy()

            if converted_record.get("forecast_time") is not None:
                converted_record["forecast_time"] = (
                    converted_record["forecast_time"].isoformat()
                )

            if converted_record.get("fetched_at") is not None:
                converted_record["fetched_at"] = (
                    converted_record["fetched_at"].isoformat()
                )

            serializable_records.append(converted_record)

        payload = {
            "schema_version": SCHEMA_VERSION,
            "records": serializable_records
        }

        payload_bytes = json.dumps(payload).encode("utf-8")

        print(f"Payload size: {len(payload_bytes)} bytes")

        # Invoke the database writer Lambda asynchronously.
        response = lambda_client.invoke(
            FunctionName="shadeadapt-hourly-forecast-ingestion",
            InvocationType="Event",
            Payload=payload_bytes
        )

        print(
            f"Ingestion Lambda invocation status: "
            f"{response['StatusCode']}"
        )

        if "FunctionError" in response:
            raise RuntimeError(
                "Hourly forecast ingestion Lambda invocation failed."
            )

        return {
            "statusCode": 200,
            "body": (
                f"Fetched {len(records)} forecast records and "
                "successfully sent them to the RDS writer."
            )
        }

    except Exception as error:
        print(f"Hourly forecast fetch/invoke failed: {error}")
        raise