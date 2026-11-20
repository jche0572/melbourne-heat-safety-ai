import pandas as pd
df = pd.read_csv("data/drinking-fountains.csv")
print("Shape:", df.shape)


# Required fields for SolAdapt
required_columns = [
    "AssetID",
    "SubType",
    "LocationDescription",
    "Latitude",
    "Longitude"
]

print("\nMissing values in required fields:")
print(df[required_columns].isnull().sum())

print("\nDuplicate AssetIDs:")
print(df["AssetID"].duplicated().sum())

print("\nDuplicate full rows:")
print(df.duplicated().sum())

print("\nFountain subtypes:")
print(df["SubType"].value_counts(dropna=False))

print("\nLatitude range:")
print(df["Latitude"].min(), "to", df["Latitude"].max())

print("\nLongitude range:")
print(df["Longitude"].min(), "to", df["Longitude"].max())

# Broad Melbourne coordinate sanity check
invalid_coordinates = df[
    (df["Latitude"] < -38) |
    (df["Latitude"] > -37) |
    (df["Longitude"] < 144) |
    (df["Longitude"] > 146)
]

print("\nRecords outside broad Melbourne coordinate bounds:")
print(len(invalid_coordinates))

print("\nDuplicate coordinate pairs:")
print(df.duplicated(subset=["Latitude", "Longitude"]).sum())

# DATA PREPARATION
# Keep only human drinking-water facilities
prepared = df[
    df["SubType"].isin([
        "Drinking Fountain",
        "Bottle Refill Tap"
    ])
].copy()

# Keep only fields required by SolAdapt
prepared = prepared[
    [
        "AssetID",
        "SubType",
        "LocationDescription",
        "Latitude",
        "Longitude"
    ]
]

# Standardise column names
prepared = prepared.rename(columns={
    "AssetID": "asset_id",
    "SubType": "facility_type",
    "LocationDescription": "location_description",
    "Latitude": "latitude",
    "Longitude": "longitude"
})

# FINAL VALIDATION
print("\nPrepared dataset shape:")
print(prepared.shape)

print("\nPrepared columns:")
print(prepared.columns.tolist())

print("\nFacility types:")
print(prepared["facility_type"].value_counts())

print("\nMissing values:")
print(prepared.isnull().sum())

print("\nDuplicate asset IDs:")
print(prepared["asset_id"].duplicated().sum())

print("\nDuplicate coordinate pairs:")
print(
    prepared.duplicated(
        subset=["latitude", "longitude"]
    ).sum()
)

# EXPORT
prepared.to_csv(
    "data/drinking_fountains_prepared.csv",
    index=False
)

print("\nPrepared dataset saved successfully.")