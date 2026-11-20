const {
  retrieveGuidanceEvidence,
  toEvidenceReference,
} = require("./ragRetrieval");
const {
  buildRagLlmInput,
  generateRagRecommendation,
  getRagDeterministicFallback,
} = require("./activityRecommendationLlm");

function buildRetrievalQuery({
  activity = {},
  environment = {},
  alternative = {},
} = {}) {
  const description = [activity.title, activity.description]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
  const terms = ["older adults", "outdoor physical activity"];
  terms.push("activity timing");

  if (/\bwalk(?:ing)?\b|hike|stroll/.test(description)) {
    terms.push("walking");
  } else if (/\brun(?:ning)?\b|jog/.test(description)) {
    terms.push("running");
  } else if (/cycle|bike|ride/.test(description)) {
    terms.push("cycling");
  }

  if (
    environment.heatCategory &&
    environment.heatCategory !== "UNAVAILABLE"
  ) {
    terms.push("hot weather, heat exposure and hydration considerations");
  }

  if (
    environment.uvCategory &&
    environment.uvCategory !== "UNAVAILABLE"
  ) {
    terms.push("UV exposure, shade and sun protection");
  }

  if (alternative.recommended === true) {
    terms.push("activity timing and a cooler time of day");
  }

  if (/hydration|hydrate|water|fluid|drink/.test(description)) {
    terms.push("hydration considerations");
  }

  if (/shade|tree|canopy|cooling/.test(description)) {
    terms.push("shade and cooling");
  }

  return terms.join(", ");
}

async function buildHybridRecommendation(pool, structuredFacts, options = {}) {
  const retrievalQuery = buildRetrievalQuery(structuredFacts);
  let evidence = [];
  let ragStatus = "unavailable";

  try {
    evidence = await retrieveGuidanceEvidence(
      pool,
      retrievalQuery,
      options.retrieval ?? {}
    );
    ragStatus = evidence.length > 0 ? "available" : "unavailable";
  } catch (error) {
    console.error(
      "RAG retrieval failed:",
      error instanceof Error ? error.message : "unknown error"
    );
  }

  const evidenceReferences = evidence.map(toEvidenceReference);
  const language = evidence.length
    ? await generateRagRecommendation(
        { structuredFacts, evidence },
        { ...(options.generation ?? {}), includeSource: true }
      )
    : {
        ...getRagDeterministicFallback(
          buildRagLlmInput({ structuredFacts, evidence: [] })
        ),
        _source: "fallback",
      };

  return {
    retrievalQuery,
    ragStatus,
    evidence: evidenceReferences,
    language,
    recommendationStatus:
      ragStatus === "unavailable"
        ? "evidence_unavailable"
        : language._source === "gemini"
          ? "gemini"
          : "fallback",
  };
}

module.exports = {
  buildHybridRecommendation,
  buildRetrievalQuery,
};
