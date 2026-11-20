import json
import os

from datetime import datetime, timezone

import boto3

from data.validation_microclimate import (
    get_validated_microclimate_data,
)


SCHEMA_VERSION = 1
MAX_ASYNC_PAYLOAD_BYTES = 900 * 1024


def serialize_record(record):
    """Convert one validated record into a JSON-safe dictionary."""

    received_at = record.get("received_at")

    if not isinstance(received_at, datetime):
        raise ValueError(
            "Validated record received_at must be a datetime."
        )

    if (
        received_at.tzinfo is None
        or received_at.utcoffset() is None
    ):
        raise ValueError(
            "Validated record received_at must include a timezone."
        )

    serialized = dict(record)
    serialized["received_at"] = (
        received_at
        .astimezone(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z")
    )

    return serialized


def lambda_handler(event, context):
    """Fetch, validate and queue microclimate records for ingestion."""

    ingestion_lambda_arn = os.environ.get(
        "INGESTION_LAMBDA_ARN"
    )

    if not ingestion_lambda_arn:
        raise ValueError(
            "INGESTION_LAMBDA_ARN is not configured."
        )

    records = get_validated_microclimate_data()

    payload = {
        "schema_version": SCHEMA_VERSION,
        "records": [
            serialize_record(record)
            for record in records
        ],
    }

    payload_bytes = json.dumps(
        payload,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")

    if len(payload_bytes) > MAX_ASYNC_PAYLOAD_BYTES:
        raise ValueError(
            "Validated microclimate payload exceeds "
            "the 900 KiB safety limit."
        )

    print(
        "Invoking microclimate ingestion Lambda "
        f"with {len(records)} records "
        f"({len(payload_bytes)} bytes)."
    )

    response = boto3.client("lambda").invoke(
        FunctionName=ingestion_lambda_arn,
        InvocationType="Event",
        Payload=payload_bytes,
    )

    if response.get("StatusCode") != 202:
        raise RuntimeError(
            "Microclimate ingestion Lambda did not accept "
            "the asynchronous invocation."
        )

    return {
        "statusCode": 202,
        "body": (
            "Validated microclimate records queued "
            "for ingestion."
        ),
        "recordCount": len(records),
        "payloadBytes": len(payload_bytes),
    }
