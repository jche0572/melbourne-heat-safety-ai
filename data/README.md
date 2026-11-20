# SolAdapt Data

This directory contains data validation and preparation scripts used by SolAdapt.

Raw source data is kept separate from application-ready data. Validation and preparation are performed before data is loaded into the project database or used by application features.

## Data Sources

### Tree Canopies 2021

**Source:** City of Melbourne Open Data

The dataset contains mapped tree canopy polygons based on 2021 high-resolution multispectral imagery.

The source GeoJSON contains 57,980 features.

Validation checks include:

- Missing geometries
- Invalid geometries
- Duplicate geometries
- Geometry types
- Coordinate ranges

Validation found:

- 57,980 features
- No missing geometries
- No invalid geometries
- No exact duplicate geometries

The source contains Polygon and MultiPolygon geometries. For database storage, geometries are intended to be represented as MultiPolygon geometries using SRID 4326.

The raw GeoJSON is not stored in Git because of its large file size.

### Tree Canopy Limitation

Tree canopy polygons represent mapped canopy coverage.

They can be used as an indicator of potential natural shade, but they do not guarantee that a location is shaded at a particular time because actual shade can vary with factors such as sun position and environmental conditions.

---

### Drinking Fountains

**Source:** City of Melbourne Open Data

The original dataset contains 332 records.

Validation checks include:

- Missing required fields
- Duplicate asset IDs
- Duplicate rows
- Duplicate coordinates
- Coordinate ranges
- Facility types

The prepared SolAdapt dataset contains 279 records:

- 156 Drinking Fountains
- 123 Bottle Refill Taps

53 Dog Bowl records are excluded because they are not relevant to drinking water guidance for SolAdapt users.

The prepared dataset retains:

- `asset_id`
- `facility_type`
- `location_description`
- `latitude`
- `longitude`

The preparation script is:

```text
validation_drinking_fountains.py
```

The prepared output is:

```text
drinking_fountains_prepared.csv
```

---

### ARPANSA UV Observations

**Source:** Australian Radiation Protection and Nuclear Safety Agency (ARPANSA)

SolAdapt retrieves current Melbourne UV observations from the ARPANSA UV XML feed.

The UV validation script is:

```text
validation_uv.py
```

The validation process:

1. Retrieves the current ARPANSA UV XML feed.
2. Finds the Melbourne station.
3. Extracts the station name, UV index, observation timestamp and status.
4. Converts the observation timestamp to timezone-aware UTC.
5. Validates that required observation data is available.

The validated data returned by the script includes:

```text
station_name
uv_index
observed_at_utc
status
```

UV categories and alert decisions are not calculated in the validation script. These are application/business logic concerns.

UV observations are provided courtesy of ARPANSA.

### UV Data Limitations

Availability depends on the status and availability of the ARPANSA source feed.

SolAdapt should distinguish source UV observations from any risk categories, alerts or recommendations derived by the application.

---

## Microclimate Sensors

City of Melbourne microclimate sensor data is planned for integration.

Potential fields relevant to SolAdapt include:

- Device ID
- Observation timestamp
- Sensor location
- Coordinates
- Air temperature

The microclimate dataset has not yet been prepared for database ingestion.

---

## Data Processing Principles

SolAdapt follows these principles when preparing data:

- Preserve raw source data.
- Validate data before application use.
- Do not replace missing environmental measurements with artificial values such as zero.
- Keep source fields separate from application-derived fields.
- Clearly communicate source-data limitations.
- Use derived indicators only when their calculation method is defined.

## Microclimate Data Validation

SolAdapt retrieves live microclimate observations from the City of Melbourne Microclimate Sensors dataset.

Source:
https://data.melbourne.vic.gov.au/explore/dataset/microclimate-sensors-data/table/

The validation script is:

`validation_microclimate.py`

It retrieves recent observations from the City of Melbourne API and validates the fields required before the data is sent to the database loader.

### Required Fields

A record must contain:

- `device_id`
- `received_at`
- Latitude
- Longitude

### Environmental Fields

The validation process keeps:

- Air temperature
- Relative humidity

Other fields returned by the City of Melbourne API are not stored because they are not currently required by SolAdapt.

### Update Process

The microclimate ingestion process runs automatically in AWS every 15 minutes.

The validation script retrieves recent observations with an overlap window so that delayed or temporarily missed readings can still be processed.

Validated records are passed to:

`../database/load_microclimate.py`

The database loader keeps the latest available observation for each unique sensor device.