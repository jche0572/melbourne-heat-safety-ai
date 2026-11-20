import json
from collections import Counter

# Load GeoJSON
with open("data/tree-canopies-2021-urban-forest.geojson", "r") as f:
    data = json.load(f)

features = data["features"]

print("Total features:", len(features))

# Check missing geometries
missing_geometry = sum(
    1 for feature in features
    if feature.get("geometry") is None
)

print("Missing geometry:", missing_geometry)

# Check geometry types
geometry_types = Counter(
    feature["geometry"]["type"]
    for feature in features
    if feature.get("geometry") is not None
)

print("Geometry types:", geometry_types)

# Check missing geo_point_2d
missing_geo_point = sum(
    1 for feature in features
    if not feature.get("properties", {}).get("geo_point_2d")
)

print("Missing geo_point_2d:", missing_geo_point)

# Check exact duplicate geometries
geometry_strings = [
    json.dumps(feature["geometry"], sort_keys=True)
    for feature in features
    if feature.get("geometry") is not None
]

duplicate_geometries = (
    len(geometry_strings)
    - len(set(geometry_strings))
)

print("Exact duplicate geometries:", duplicate_geometries)

# Check all property names present in the dataset
property_names = set()

for feature in features:
    property_names.update(
        feature.get("properties", {}).keys()
    )

print("Property fields:", property_names)

from shapely.geometry import shape
from shapely.validation import explain_validity

invalid_geometries = []

for i, feature in enumerate(features):
    geometry = feature.get("geometry")

    if geometry is not None:
        geom = shape(geometry)

        if not geom.is_valid:
            invalid_geometries.append({
                "feature_index": i,
                "reason": explain_validity(geom)
            })

print("\nInvalid geometries:", len(invalid_geometries))

if invalid_geometries:
    print("First 10 invalid geometries:")
    for item in invalid_geometries[:10]:
        print(item)

# Check coordinate bounds of all geometries
min_lon = float("inf")
max_lon = float("-inf")
min_lat = float("inf")
max_lat = float("-inf")

for feature in features:
    geometry = feature.get("geometry")

    if geometry is not None:
        geom = shape(geometry)

        minx, miny, maxx, maxy = geom.bounds

        min_lon = min(min_lon, minx)
        max_lon = max(max_lon, maxx)
        min_lat = min(min_lat, miny)
        max_lat = max(max_lat, maxy)

print("\nCoordinate bounds:")
print("Longitude:", min_lon, "to", max_lon)
print("Latitude:", min_lat, "to", max_lat)

# Broad sanity check for Melbourne
outside_melbourne = 0

for feature in features:
    geometry = feature.get("geometry")

    if geometry is not None:
        geom = shape(geometry)
        minx, miny, maxx, maxy = geom.bounds

        if (
            minx < 144
            or maxx > 146
            or miny < -38
            or maxy > -37
        ):
            outside_melbourne += 1

print(
    "Geometries outside broad Melbourne bounds:",
    outside_melbourne
)        