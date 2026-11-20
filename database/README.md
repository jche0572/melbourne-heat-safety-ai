# SolAdapt Database

SolAdapt uses Amazon RDS for PostgreSQL with the PostGIS extension to store spatial and environmental data.

This directory contains the database schema and ingestion scripts used by the project.

## Database Technology

- PostgreSQL
- PostGIS
- Amazon RDS
- SRID 4326 for project spatial data

The database schema is defined in:

```text
schema.sql
```

## Current Project Tables

### `tree_canopies`

Stores tree canopy geometries.

Main fields:

- `canopy_id`
- `geometry`

Geometry type:

```text
MULTIPOLYGON
```

Coordinate reference system:

```text
EPSG:4326
```

A GiST spatial index is used to support spatial queries.

---

### `drinking_fountains`

Stores drinking fountain and bottle refill locations.

Main fields:

- `asset_id`
- `facility_type`
- `location_description`
- `latitude`
- `longitude`
- `location`

`location` is stored as a PostGIS Point with SRID 4326.

A GiST spatial index is used for spatial queries.

---

### `uv_observations`

Stores validated Melbourne UV observations.

Main fields:

- `id`
- `station_name`
- `uv_index`
- `observed_at_utc`
- `status`
- `created_at`

A unique index on:

```text
station_name + observed_at_utc
```

prevents duplicate observations.

## UV Data Ingestion

The UV database ingestion script is:

```text
load_uv.py
```

The ingestion process is:

```text
ARPANSA UV Feed
        ↓
data/validation_uv.py
        ↓
database/load_uv.py
        ↓
PostgreSQL
        ↓
uv_observations
```

The script only inserts an observation when the required validated UV data is available.

Duplicate observations are prevented using the station name and source observation timestamp.

## Automated UV Ingestion

The UV ingestion process is deployed using AWS Lambda.

Amazon EventBridge invokes the Lambda function automatically every minute.

The automated process is:

```text
EventBridge
     ↓
AWS Lambda
     ↓
ARPANSA UV Feed
     ↓
UV Validation
     ↓
Amazon RDS
     ↓
uv_observations
```

The source may not produce a new observation timestamp every minute. When the same observation is retrieved again, the database duplicate constraint prevents another copy from being inserted.

## Database Connection

Team members who require access to the development database should obtain the connection details privately from the team.

Do not commit database credentials to Git.

Required connection values are:

```text
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
```

The development database name is:

```text
shadeadapt
```

The PostgreSQL port is:

```text
5432
```

The host, username and password should be provided privately to authorised team members.

### Environment Variables

Example:

```bash
export DB_HOST="<database-host>"
export DB_PORT="5432"
export DB_NAME="shadeadapt"
export DB_USER="<database-user>"
export DB_PASSWORD="<database-password>"
```

Do not replace the placeholders with real credentials in this README.

## Connecting with psql

After configuring the environment variables:

```bash
psql "host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER sslmode=require"
```

## Check Project Tables

Inside `psql`:

```sql
\dt
```

PostGIS may create its own system objects in addition to SolAdapt's project tables.

For example, `spatial_ref_sys` is a PostGIS system table and should not be treated as a SolAdapt dataset.

## Check Drinking Fountain Data

```sql
SELECT COUNT(*)
FROM drinking_fountains;
```

The prepared dataset should contain 279 records.

Check spatial locations:

```sql
SELECT COUNT(*)
FROM drinking_fountains
WHERE location IS NULL;
```
## Drinking Fountain Data Import

The prepared Drinking Fountains dataset is loaded into PostgreSQL/PostGIS using:

```text
load_drinking_fountains.py
```

The process is:

```text
data/drinking_fountains_prepared.csv
        ↓
database/load_drinking_fountains.py
        ↓
PostgreSQL / PostGIS
        ↓
drinking_fountains
```

The loader creates a PostGIS Point from each record's longitude and latitude using SRID 4326.

Existing records with the same `asset_id` are updated rather than duplicated, allowing the loader to be safely rerun.

The completed database import was validated with the following results:

- Database records: 279
- Missing required values: 0
- Duplicate asset IDs: 0
- Geometry type: POINT for all 279 records
- SRID: EPSG:4326 for all 279 records

The data is already loaded in the development database. If the dataset needs to be reloaded or the database rebuilt, run:

```bash
python3 database/load_drinking_fountains.py
```

Database environment variables must be configured first.

## Check Latest UV Observation

```sql
SELECT
    station_name,
    uv_index,
    observed_at_utc,
    status,
    created_at
FROM uv_observations
ORDER BY observed_at_utc DESC
LIMIT 1;
```

## Running UV Ingestion Manually

Normal UV ingestion is automated through AWS Lambda and EventBridge.

For development or debugging, it can also be run manually:

```bash
python3 database/load_uv.py
```

Database environment variables must be configured first.

Manual execution is not required for normal operation of the automated pipeline.

## Tree Canopy Import

The Tree Canopies 2021 dataset has been successfully loaded into PostgreSQL/PostGIS.

The import script is:

```text
load_tree_canopies.sh
```

The process is:

```text
Tree Canopies 2021 GeoJSON
        ↓
data/validation_canopies.py
        ↓
database/load_tree_canopies.sh
        ↓
GDAL / ogr2ogr
        ↓
PostgreSQL / PostGIS
        ↓
tree_canopies
```

The import script loads the required canopy geometry into the existing `tree_canopies` table and converts source Polygon geometries to MultiPolygon where required to match the database schema.

The source `geo_point_2d` attribute is not loaded because SolAdapt uses the complete canopy polygon geometry for spatial analysis.

The raw GeoJSON is not committed to Git because of its large file size.

### Running the Import
This script is intended for initial database population. Do not rerun it against an already populated tree_canopies table unless the existing data has been cleared or a controlled reload is required.

GDAL is required for the `ogr2ogr` command.

On macOS with Homebrew:

```bash
brew install gdal
```

After configuring the database environment variables, run:

```bash
bash database/load_tree_canopies.sh
```

### Import Validation

The completed import was validated with the following results:

- Source features: 57,980
- Database records: 57,980
- Geometry type: MULTIPOLYGON for all 57,980 records
- Missing geometries: 0
- Invalid geometries: 0
- SRID: EPSG:4326 for all 57,980 records

These checks confirm that all expected canopy features were successfully loaded and that the stored spatial data conforms to the SolAdapt database schema.

## Microclimate Data

SolAdapt uses the City of Melbourne Microclimate Sensors dataset to obtain current environmental conditions from microclimate sensors across Melbourne.

Source:
https://data.melbourne.vic.gov.au/explore/dataset/microclimate-sensors-data/table/

### Database Table

Microclimate data is stored in:

`microclimate_observations`

The table stores the latest available reading for each unique sensor device.

When a newer observation is received for an existing sensor, the existing row is updated rather than inserting another historical row.

The table stores:

- Device ID
- Observation timestamp
- Sensor location
- Latitude and longitude
- PostGIS point geometry
- Air temperature
- Relative humidity

### Automated Data Ingestion

Microclimate data is automatically updated using AWS.

Pipeline:

City of Melbourne Microclimate API  
→ AWS Lambda  
→ Data validation  
→ PostgreSQL/PostGIS on AWS RDS

The Lambda function is:

`shadeadapt-microclimate-ingestion`

The function is triggered by Amazon EventBridge every 15 minutes using:

`rate(15 minutes)`

The ingestion process validates recent API observations and performs an UPSERT based on `device_id`.

- New sensor → insert a new row
- Existing sensor with newer data → update the existing row
- Same or older observation → ignore

This ensures that the database maintains the latest available reading for each microclimate sensor.

### Related Files

- `../data/validation_microclimate.py` — retrieves and validates microclimate API data
- `load_microclimate.py` — loads validated readings into PostgreSQL
- `requirements_microclimate.txt` — Python dependencies required by the ingestion process
- `schema.sql` — database table and index definitions