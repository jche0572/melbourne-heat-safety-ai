import json
import os
from pathlib import Path

import psycopg


# ============================================================
# File path configuration
# ============================================================

# Get the root folder of the whole projects project.
#
# Example:
# melbourne-heat-safety-ai/
# ├── data/
# ├── database/
# ├── mobile/
# └── server/
#
# __file__ points to:
# database/load_municipal_boundary.py
#
# .parent gives:
# database/
#
# .parent.parent gives:
# melbourne-heat-safety-ai/
PROJECT_ROOT = Path(__file__).resolve().parent.parent


# Full path to the City of Melbourne municipal boundary GeoJSON file.
#
# Expected location:
# melbourne-heat-safety-ai/data/municipal_boundary.geojson
GEOJSON_PATH = PROJECT_ROOT / "data" / "municipal_boundary.geojson"


# ============================================================
# Step 1: Read and validate the GeoJSON file
# ============================================================

def load_geojson():
    """
    Read the City of Melbourne municipal boundary GeoJSON file
    and return only valid Polygon or MultiPolygon features.

    This function does NOT connect to the database.
    It only validates the local GeoJSON file first.
    """

    # Check that the GeoJSON file actually exists.
    # This prevents the loader from failing later with a less clear error.
    if not GEOJSON_PATH.exists():
        raise FileNotFoundError(
            f"Municipal boundary GeoJSON not found: {GEOJSON_PATH}"
        )

    # Open the GeoJSON file and convert the JSON content
    # into a normal Python dictionary.
    with open(GEOJSON_PATH, "r", encoding="utf-8") as file:
        geojson_data = json.load(file)

    # A standard exported GeoJSON dataset usually has:
    #
    # {
    #   "type": "FeatureCollection",
    #   "features": [...]
    # }
    #
    # We check this before trying to read the individual features.
    if geojson_data.get("type") != "FeatureCollection":
        raise ValueError(
            "Expected the municipal boundary file to be a GeoJSON FeatureCollection."
        )

    # Get the list of geographical features.
    features = geojson_data.get("features", [])

    # The dataset should contain at least one boundary feature.
    if not features:
        raise ValueError(
            "The municipal boundary GeoJSON does not contain any features."
        )

    # We will store only valid polygon-based features here.
    valid_features = []

    # Check every feature in the GeoJSON dataset.
    for feature in features:

        # Each GeoJSON feature should contain a geometry object.
        geometry = feature.get("geometry")

        # If there is no geometry, there is nothing useful
        # to store in PostGIS, so skip this feature.
        if not geometry:
            print("Skipping feature because it has no geometry.")
            continue

        # GeoJSON geometry types can include:
        # Point, LineString, Polygon, MultiPolygon, etc.
        geometry_type = geometry.get("type")

        # For a municipal boundary, we only want polygon geometry.
        #
        # Polygon:
        # one polygon area
        #
        # MultiPolygon:
        # multiple polygon areas stored as one geometry
        if geometry_type not in ("Polygon", "MultiPolygon"):
            print(
                f"Skipping unsupported geometry type: {geometry_type}"
            )
            continue

        # This feature is valid for our service-area boundary.
        valid_features.append(feature)

    # If no usable polygon was found, stop the program.
    if not valid_features:
        raise ValueError(
            "No valid Polygon or MultiPolygon geometry was found "
            "in the municipal boundary GeoJSON."
        )

    print(
        f"Validated {len(valid_features)} municipal boundary feature(s)."
    )

    # Return the validated features so the next function
    # can insert them into PostgreSQL/PostGIS.
    return valid_features


# ============================================================
# Step 2: Insert the validated boundary into PostgreSQL/PostGIS
# ============================================================

def load_boundary_to_database():
    """
    Load the City of Melbourne municipal boundary into the
    municipal_boundary table in AWS RDS PostgreSQL/PostGIS.

    The workflow is:

    GeoJSON file
        ↓
    Validate polygon geometry
        ↓
    Connect to RDS
        ↓
    Remove old boundary data
        ↓
    Convert GeoJSON geometry to PostGIS geometry
        ↓
    Insert new boundary data
    """

    # First validate the local GeoJSON file.
    # If there is a problem with the file, the script stops here
    # before making any database changes.
    features = load_geojson()

    # ========================================================
    # Database environment variables
    # ========================================================

    # Read database connection details from environment variables.
    #
    # We do NOT hard-code passwords or database credentials
    # inside the Python source code.
    db_host = os.environ.get("DB_HOST")
    db_name = os.environ.get("DB_NAME")
    db_user = os.environ.get("DB_USER")
    db_password = os.environ.get("DB_PASSWORD")

    # PostgreSQL normally uses port 5432.
    # If DB_PORT does not exist, use 5432 automatically.
    db_port = os.environ.get("DB_PORT", "5432")

    # Store the required variables in a dictionary so we can
    # easily check whether any of them are missing.
    required_variables = {
        "DB_HOST": db_host,
        "DB_NAME": db_name,
        "DB_USER": db_user,
        "DB_PASSWORD": db_password,
    }

    # Build a list containing the names of any missing variables.
    missing_variables = [
        variable_name
        for variable_name, variable_value in required_variables.items()
        if not variable_value
    ]

    # Stop before connecting if required credentials are missing.
    if missing_variables:
        raise ValueError(
            "Missing database environment variables: "
            + ", ".join(missing_variables)
        )

    # ========================================================
    # Connect to AWS RDS PostgreSQL
    # ========================================================

    # psycopg.connect() creates the PostgreSQL connection.
    #
    # sslmode="require" forces the connection to use SSL,
    # which is appropriate for connecting to AWS RDS.
    with psycopg.connect(
        host=db_host,
        dbname=db_name,
        user=db_user,
        password=db_password,
        port=db_port,
        sslmode="require",
    ) as connection:

        # Create a cursor.
        # The cursor is used to execute SQL statements.
        with connection.cursor() as cursor:

            # ====================================================
            # Remove existing boundary data
            # ====================================================

            # The municipal boundary is a static reference dataset.
            #
            # If we run this loader again in the future,
            # we want to replace the previous copy rather than
            # create duplicate boundary rows.
            #
            # RESTART IDENTITY resets the SERIAL id back to 1.
            cursor.execute(
                """
                TRUNCATE TABLE municipal_boundary
                RESTART IDENTITY;
                """
            )

            # Keep track of how many features are inserted.
            inserted_count = 0

            # ====================================================
            # Insert each valid GeoJSON feature
            # ====================================================

            for feature in features:

                # Extract only the GeoJSON geometry object.
                #
                # Example:
                #
                # {
                #   "type": "Polygon",
                #   "coordinates": [...]
                # }
                geometry = feature["geometry"]

                # Convert the Python geometry dictionary back into
                # a JSON string because PostGIS ST_GeomFromGeoJSON()
                # accepts GeoJSON text.
                geometry_json = json.dumps(geometry)

                # Insert the boundary into the database.
                cursor.execute(
                    """
                    INSERT INTO municipal_boundary (
                        name,
                        geometry,
                        source
                    )
                    VALUES (
                        %s,

                        -- Convert GeoJSON into PostGIS geometry.
                        ST_Multi(
                            ST_SetSRID(
                                ST_GeomFromGeoJSON(%s),
                                4326
                            )
                        ),

                        %s
                    );
                    """,
                    (
                        # Name stored in the database.
                        "City of Melbourne",

                        # GeoJSON geometry passed to ST_GeomFromGeoJSON().
                        geometry_json,

                        # Record where the dataset came from.
                        "City of Melbourne Municipal Boundary",
                    ),
                )

                inserted_count += 1

        # Save all database changes permanently.
        connection.commit()

    # Print a useful success message when the process completes.
    print(
        f"Successfully loaded {inserted_count} "
        "City of Melbourne municipal boundary feature(s)."
    )


# ============================================================
# Program entry point
# ============================================================

# This block runs only when we execute this file directly:
#
# python database/load_municipal_boundary.py
#
# It will not automatically run if another Python file imports it.
if __name__ == "__main__":
    load_boundary_to_database()