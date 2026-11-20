#!/bin/bash

set -e

SOURCE_FILE="data/tree-canopies-2021-urban-forest.geojson"
SOURCE_LAYER="tree-canopies-2021-urban-forest"

# Check required database environment variables
if [ -z "$DB_HOST" ] || \
   [ -z "$DB_NAME" ] || \
   [ -z "$DB_USER" ] || \
   [ -z "$DB_PASSWORD" ]; then
    echo "Missing database environment variables."
    echo "Set DB_HOST, DB_NAME, DB_USER and DB_PASSWORD before running this script."
    exit 1
fi

# Check source file exists
if [ ! -f "$SOURCE_FILE" ]; then
    echo "Tree canopy GeoJSON not found: $SOURCE_FILE"
    exit 1
fi

echo "Loading tree canopy data into PostgreSQL/PostGIS..."

ogr2ogr \
    -f "PostgreSQL" \
    "PG:host=$DB_HOST port=${DB_PORT:-5432} dbname=$DB_NAME user=$DB_USER password=$DB_PASSWORD sslmode=require" \
    "$SOURCE_FILE" \
    "$SOURCE_LAYER" \
    -nln tree_canopies \
    -append \
    -nlt PROMOTE_TO_MULTI \
    -t_srs EPSG:4326 \
    -fieldmap -1 \
    -progress

echo "Tree canopy import completed."