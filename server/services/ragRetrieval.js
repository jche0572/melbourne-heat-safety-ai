const { GoogleGenAI } = require("@google/genai");

const DIMENSION = 768;
const EMBEDDING_MODEL = "gemini-embedding-001";

function validateQueryVector(queryEmbedding) {
  if (
    !Array.isArray(queryEmbedding) ||
    queryEmbedding.length !== DIMENSION ||
    queryEmbedding.some(
      (value) =>
        typeof value !== "number" || !Number.isFinite(value)
    )
  ) {
    throw new TypeError(
      `queryEmbedding must be a finite ${DIMENSION}-dimensional array.`
    );
  }

  return queryEmbedding;
}

function vectorLiteral(values) {
  return `[${values.join(",")}]`;
}

function sourceIsCore(candidate) {
  return String(candidate?.priority ?? "")
    .trim()
    .toLowerCase() === "core";
}

function selectDiverse(candidates, limit = 5, maxPerSource = 2) {
  const selected = [];
  const selectedIds = new Set();
  const counts = new Map();
  const top = candidates[0];
  const topSourceCandidates = candidates.filter(
    (candidate) => candidate.source_id === top?.source_id
  );
  const bestOtherSource = candidates.find(
    (candidate) => candidate.source_id !== top?.source_id
  );
  const topSourceDominates =
    sourceIsCore(top) &&
    topSourceCandidates.length > maxPerSource &&
    (!bestOtherSource ||
      Number(topSourceCandidates[maxPerSource]?.similarity) >=
        Number(bestOtherSource.similarity));

  for (const candidate of candidates) {
    if (selected.length >= limit) break;

    const count = counts.get(candidate.source_id) || 0;
    const sourceLimit =
      topSourceDominates && candidate.source_id === top?.source_id
        ? maxPerSource + 1
        : maxPerSource;

    if (count >= sourceLimit) continue;

    selected.push(candidate);
    selectedIds.add(candidate.chunk_id);
    counts.set(candidate.source_id, count + 1);
  }

  // If there are too few sources, use the remaining ranked rows.
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (selectedIds.has(candidate.chunk_id)) continue;
    selected.push(candidate);
  }

  return selected;
}

function createGeminiClient(apiKey) {
  return apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: { timeout: 30000 },
      })
    : null;
}

async function embedRetrievalQuery(queryText, options = {}) {
  if (typeof queryText !== "string" || !queryText.trim()) {
    throw new TypeError("queryText must be a non-empty string.");
  }

  const client =
    options.client ||
    createGeminiClient(options.apiKey ?? process.env.GEMINI_API_KEY);

  if (!client) {
    throw new Error("Gemini embedding client is unavailable.");
  }

  const response = await client.models.embedContent({
    model: options.model || EMBEDDING_MODEL,
    contents: queryText,
    config: {
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: DIMENSION,
    },
  });

  return validateQueryVector(response?.embeddings?.[0]?.values);
}

async function retrieveEvidenceChunks(pool, queryEmbedding, options = {}) {
  validateQueryVector(queryEmbedding);

  const candidateLimit = Number.isInteger(options.candidateLimit)
    ? options.candidateLimit
    : 15;
  const finalLimit = Number.isInteger(options.finalLimit)
    ? options.finalLimit
    : 5;
  const maxPerSource = Number.isInteger(options.maxPerSource)
    ? options.maxPerSource
    : 2;

  if (
    candidateLimit < finalLimit ||
    finalLimit < 1 ||
    maxPerSource < 1
  ) {
    throw new RangeError(
      "candidateLimit must be >= finalLimit >= 1 and maxPerSource must be >= 1."
    );
  }

  const result = await pool.query(
    `
      SELECT
        chunk_id,
        source_id,
        title,
        organisation,
        year,
        canonical_url,
        pmcid,
        licence,
        topic,
        priority,
        section_title,
        limitations,
        content,
        metadata,
        1 - (embedding <=> $1::vector) AS similarity
      FROM guidance_chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector ASC, chunk_id ASC
      LIMIT $2
    `,
    [vectorLiteral(queryEmbedding), candidateLimit]
  );

  return selectDiverse(result.rows, finalLimit, maxPerSource);
}

async function retrieveGuidanceEvidence(pool, queryText, options = {}) {
  const queryEmbedding = await embedRetrievalQuery(queryText, {
    client: options.client,
    apiKey: options.apiKey,
    model: options.embeddingModel,
  });

  return retrieveEvidenceChunks(pool, queryEmbedding, options);
}

function toEvidenceReference(row) {
  return {
    sourceId: row.source_id ?? null,
    chunkId: row.chunk_id ?? null,
    title: row.title ?? null,
    organisation: row.organisation ?? null,
    year: row.year ?? null,
    sectionTitle: row.section_title ?? null,
    priority: row.priority ?? null,
    limitations: row.limitations ?? [],
    licence: row.licence ?? null,
    canonicalUrl: row.canonical_url ?? null,
    similarity:
      row.similarity === null || row.similarity === undefined
        ? null
        : Number(row.similarity),
  };
}

module.exports = {
  DIMENSION,
  EMBEDDING_MODEL,
  embedRetrievalQuery,
  retrieveEvidenceChunks,
  retrieveGuidanceEvidence,
  selectDiverse,
  toEvidenceReference,
  validateQueryVector,
  vectorLiteral,
};
