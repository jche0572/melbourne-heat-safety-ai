# melbourne-heat-safety-ai
Main repository for the  SolAdapt project

# SolAdapt

SolAdapt is a  Industry Experience project focused on helping older adults reduce their exposure to heat and UV while travelling outdoors in the City of Melbourne.

## Repository Structure

```text
melbourne-heat-safety-ai/
├── data/       # Dataset validation and preparation
├── database/   # PostgreSQL/PostGIS schema and data ingestion
├── docs/       # Project documentation
├── mobile/     # Mobile application
└── server/     # Backend/server
```

## Database

SolAdapt uses Amazon RDS for PostgreSQL with PostGIS for spatial and environmental data.

The development database currently contains:

- Tree Canopies 2021
- Drinking Fountains
- Live Melbourne UV observations

Detailed database setup, connection instructions, ingestion scripts and validation information are available in:

```text
database/README.md
```

Team members who need database access should obtain the connection credentials privately from the team. Database credentials must not be committed to Git.

## Data

Dataset validation and preparation scripts are located in:

```text
data/
```

See the documentation in the `data` directory for information about the project datasets and preparation process.

## Hybrid RAG recommendation

The existing activity endpoint remains:

```text
POST /api/ai/activity-recommendation
```

Its flow is:

```text
activity inputs
  + hourly forecast / UV data
        ↓
deterministic forecast summary and same-day alternative-time comparison
        ↓
deterministic retrieval query
        ↓
gemini-embedding-001
  taskType: RETRIEVAL_QUERY, outputDimensionality: 768
        ↓
PostgreSQL guidance_chunks with pgvector cosine search
        ↓
15 candidates → source-diverse 5 evidence chunks
        ↓
Gemini structured recommendation language
        ↓
backward-compatible API response + evidence references
```

Structured forecast data is authoritative for current/forecast temperature, UV, location and any alternative time. RAG only explains the rationale for older adults; it does not select an alternative or provide current Melbourne measurements. The existing `guidance_chunks` table is read-only in this flow and must already contain the existing 768-dimensional embeddings.

The response keeps the existing `shortRecommendation`, `practicalAdvice`, `alternativeTimeExplanation`, `forecast`, `environmentSummary` and alternative-time fields. It also provides `recommendation`, `evidence`, `rag.status` and `recommendationStatus`. If retrieval is unavailable, the endpoint returns deterministic fallback language with `rag.status: "unavailable"`; if Gemini generation fails, retrieved evidence remains available and `recommendationStatus` is `"fallback"`.

Run backend tests from `server/` with:

```text
npm test
```

This flow does not add sources, regenerate embeddings, change ports or deploy automatically. Before deployment, validate the backend with the production environment variables `GEMINI_API_KEY`, `GEMINI_MODEL` and the existing database connection, then use a separate PM2 test process/port and confirm health before reloading the production service.

## Development

Before working on a project component, check the relevant directory and its documentation for setup instructions.

Do not commit passwords, database credentials, environment files or other sensitive information to the repository.
