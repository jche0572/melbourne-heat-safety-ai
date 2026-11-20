-- SolAdapt Database Schema

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;


-- 1. TREE CANOPIES

CREATE TABLE IF NOT EXISTS tree_canopies (
    canopy_id BIGSERIAL PRIMARY KEY,
    geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tree_canopies_geometry
ON tree_canopies
USING GIST (geometry);


-- 2. DRINKING FOUNTAINS

CREATE TABLE IF NOT EXISTS drinking_fountains (
    asset_id BIGINT PRIMARY KEY,
    facility_type VARCHAR(50) NOT NULL,
    location_description TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOMETRY(POINT, 4326)
);

CREATE INDEX IF NOT EXISTS idx_drinking_fountains_location
ON drinking_fountains
USING GIST (location);


-- 3. UV OBSERVATIONS

CREATE TABLE IF NOT EXISTS uv_observations (
    id BIGSERIAL PRIMARY KEY,
    station_name VARCHAR(50) NOT NULL,
    uv_index NUMERIC(4,1),
    observed_at_utc TIMESTAMPTZ NOT NULL,
    status VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CHECK (uv_index IS NULL OR uv_index >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uv_station_observed
ON uv_observations (station_name, observed_at_utc);


-- 4. MICROCLIMATE OBSERVATIONS

CREATE TABLE IF NOT EXISTS microclimate_observations (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    sensor_location TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOMETRY(POINT, 4326) NOT NULL,
    air_temperature DOUBLE PRECISION,
    relative_humidity DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        relative_humidity IS NULL
        OR (
            relative_humidity >= 0
            AND relative_humidity <= 100
        )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS
idx_microclimate_device
ON microclimate_observations (
    device_id
);

CREATE INDEX IF NOT EXISTS
idx_microclimate_received_at
ON microclimate_observations (
    received_at DESC
);

CREATE INDEX IF NOT EXISTS
idx_microclimate_location
ON microclimate_observations
USING GIST (location);


-- 5. HOURLY FORECAST

CREATE TABLE IF NOT EXISTS hourly_forecast (
    forecast_id BIGSERIAL PRIMARY KEY,
    forecast_time TIMESTAMPTZ NOT NULL,

    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,

    temperature_c NUMERIC(5,2) NOT NULL,

    relative_humidity NUMERIC(5,2),
    wind_speed_10m_ms NUMERIC(6,2),
    shortwave_radiation_wm2 NUMERIC(7,2),

    apparent_temperature_c NUMERIC(5,2) NOT NULL,
    uv_index NUMERIC(4,2) NOT NULL,

    timezone VARCHAR(50) NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL,
    source VARCHAR(50) NOT NULL,

    CHECK (uv_index >= 0),

    CHECK (
        relative_humidity IS NULL
        OR (
            relative_humidity >= 0
            AND relative_humidity <= 100
        )
    ),

    CHECK (
        wind_speed_10m_ms IS NULL
        OR wind_speed_10m_ms >= 0
    ),

    CHECK (
        shortwave_radiation_wm2 IS NULL
        OR shortwave_radiation_wm2 >= 0
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_forecast_time_location
ON hourly_forecast (
    forecast_time,
    latitude,
    longitude
);

CREATE INDEX IF NOT EXISTS idx_hourly_forecast_time
ON hourly_forecast (
    forecast_time
);


-- 6. MUNICIPAL BOUNDARY

CREATE TABLE IF NOT EXISTS municipal_boundary (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    source VARCHAR(255),
    loaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_municipal_boundary_geometry
ON municipal_boundary
USING GIST (geometry);


-- 7. RAG GUIDANCE KNOWLEDGE BASE

CREATE TABLE IF NOT EXISTS guidance_chunks (
    id BIGSERIAL PRIMARY KEY,
    chunk_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    title TEXT NOT NULL,
    organisation TEXT NOT NULL,
    year INTEGER NOT NULL,
    canonical_url TEXT NOT NULL,
    pmcid TEXT,
    licence TEXT NOT NULL,
    topic TEXT[] NOT NULL,
    priority TEXT NOT NULL,
    section_title TEXT NOT NULL,
    limitations JSONB NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(768) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT guidance_chunks_chunk_id_key
        UNIQUE (chunk_id),

    CONSTRAINT guidance_chunks_embedding_dimension
        CHECK (vector_dims(embedding) = 768)
);