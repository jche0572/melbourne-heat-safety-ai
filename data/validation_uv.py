import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

UV_URL = "https://uvdata.arpansa.gov.au/xml/uvvalues.xml"


def get_validated_uv_data():
    """Fetch and validate the latest Melbourne UV observation from ARPANSA."""

    # 1. FETCH LIVE XML DATA
    response = requests.get(UV_URL, timeout=10)
    response.raise_for_status()

    root = ET.fromstring(response.content)
    stations = root.findall(".//location")

    # 2. FIND MELBOURNE STATION
    melbourne = None

    for station in stations:
        if station.get("id") == "Melbourne":
            melbourne = station
            break

    if melbourne is None:
        raise ValueError("Melbourne UV station not found.")

    # 3. EXTRACT SOURCE DATA
    station_name = melbourne.get("id")
    uv_index_raw = melbourne.findtext("index")
    utc_raw = melbourne.findtext("utcdatetime")
    status = melbourne.findtext("status")

    # 4. VALIDATE DATA AVAILABILITY
    if status is None or status.lower() != "ok":
        uv_index = None
    else:
        try:
            uv_index = float(uv_index_raw)
        except (TypeError, ValueError):
            raise ValueError("UV index is not a valid number.")

        if uv_index < 0:
            raise ValueError("UV index cannot be negative.")

    # 5. PARSE OBSERVATION TIMESTAMP
    observed_at_utc = None

    if utc_raw:
        try:
            observed_at_utc = datetime.strptime(
                utc_raw,
                "%Y/%m/%d %H:%M"
            ).replace(tzinfo=timezone.utc)
        except ValueError:
            raise ValueError("Invalid ARPANSA UTC datetime format.")

    elif status is not None and status.lower() == "ok":
        raise ValueError("UTC observation timestamp is missing.")

    # 6. RETURN VALIDATED DATA
    return {
        "station_name": station_name,
        "uv_index": uv_index,
        "observed_at_utc": observed_at_utc,
        "status": status
    }


# Run validation directly for testing
if __name__ == "__main__":
    uv_data = get_validated_uv_data()

    print("Validated Melbourne UV data:")

    for key, value in uv_data.items():
        print(f"{key}: {value}")