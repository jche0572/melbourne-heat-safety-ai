const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  EMBEDDING_MODEL,
  retrieveGuidanceEvidence,
  selectDiverse,
} = require("../services/ragRetrieval");
const {
  buildHybridRecommendation,
  buildRetrievalQuery,
} = require("../services/hybridRecommendation");
const {
  RAG_OUTPUT_SCHEMA,
  RAG_SYSTEM_INSTRUCTION,
  buildRagLlmInput,
  generateRagRecommendation,
  getRagDeterministicFallback,
  getRagLlmOutputRejectionReason,
  validateRagLlmOutput,
} = require("../services/activityRecommendationLlm");

const vector = Array.from({ length: 768 }, () => 0.01);

const facts = {
  activity: {
    title: "Walking",
    location: "Melbourne",
    description: "Outdoor walk with water and shade breaks",
    startTime: "2026-09-13T14:00:00+10:00",
    endTime: "2026-09-13T15:00:00+10:00",
  },
  environment: {
    peakTemperatureC: 31,
    peakApparentTemperatureC: 33,
    peakUvIndex: 8,
    heatCategory: "EXTREME",
    uvCategory: "EXTREME",
    sunProtectionRecommended: true,
  },
  alternative: {
    recommended: true,
    startTime: "2026-09-13T09:00:00+10:00",
    endTime: "2026-09-13T10:00:00+10:00",
    peakApparentTemperatureC: 24,
    peakUvIndex: 3,
  },
};

const evidenceRows = [
  ["RAG-019-C001", "RAG-019", "Core", "0.900"],
  ["RAG-019-C002", "RAG-019", "Core", "0.890"],
  ["RAG-019-C003", "RAG-019", "Core", "0.880"],
  ["RAG-019-C004", "RAG-019", "Core", "0.870"],
  ["RAG-010-C001", "RAG-010", "Supporting authoritative", "0.750"],
  ["RAG-009-C001", "RAG-009", "Supporting authoritative", "0.740"],
].map(([chunk_id, source_id, priority, similarity]) => ({
  chunk_id,
  source_id,
  priority,
  similarity,
  title: `${source_id} title`,
  section_title: "Evidence section",
  content: `${source_id} evidence content`,
  limitations: [],
  licence: "CC BY 4.0",
  canonical_url: `https://example.test/${source_id}`,
}));

const validExplanation = {
  why: [
    "The heat category supports choosing the supplied alternative.",
    "The UV category supports using sun protection.",
  ],
  practicalActions: [
    "Use sun protection.",
    "Choose potential shade where available.",
    "Bring water and take breaks as needed.",
  ],
};

function embeddingClient() {
  return {
    models: {
      embedContent: async (request) => {
        assert.equal(request.model, EMBEDDING_MODEL);
        assert.equal(request.config.taskType, "RETRIEVAL_QUERY");
        assert.equal(request.config.outputDimensionality, 768);
        return { embeddings: [{ values: vector }] };
      },
    },
  };
}

function generationClient(output, requests = []) {
  return {
    models: {
      generateContent: async (request) => {
        requests.push(request);
        return { text: JSON.stringify(output) };
      },
    },
  };
}

async function captureErrors(run) {
  const errors = [];
  const originalError = console.error;
  console.error = (...values) => errors.push(values.join(" "));
  try {
    return { result: await run(), errors };
  } finally {
    console.error = originalError;
  }
}

function generationOptions(output, requests = []) {
  return {
    model: "test-model",
    client: generationClient(output, requests),
    includeSource: true,
  };
}

test("retrieval embeds a deterministic query and selects a dominant Core source sensibly", async () => {
  let sql;
  const pool = {
    query: async (text, params) => {
      sql = { text, params };
      return { rows: evidenceRows };
    },
  };

  const results = await retrieveGuidanceEvidence(
    pool,
    buildRetrievalQuery(facts),
    { client: embeddingClient(), candidateLimit: 6, finalLimit: 5 }
  );

  assert.match(sql.text, /guidance_chunks/);
  assert.match(sql.text, /embedding <=> \$1::vector/);
  assert.equal(sql.params[0].split(",").length, 768);
  assert.deepEqual(
    results.map((row) => row.chunk_id),
    [
      "RAG-019-C001",
      "RAG-019-C002",
      "RAG-019-C003",
      "RAG-010-C001",
      "RAG-009-C001",
    ]
  );
});

test("ordinary source diversity remains capped at two chunks", () => {
  const ordinary = [
    ...evidenceRows,
    { ...evidenceRows[4], chunk_id: "RAG-010-C002", similarity: "0.730" },
    { ...evidenceRows[5], chunk_id: "RAG-009-C002", similarity: "0.720" },
  ].map((row) => ({
    ...row,
    priority: "Supporting authoritative",
  }));
  const selected = selectDiverse(ordinary, 5, 2);
  assert.equal(selected.filter((row) => row.source_id === "RAG-019").length, 2);
});

test("retrieval query is deterministic and excludes exact weather values", () => {
  const query = buildRetrievalQuery(facts);
  assert.match(query, /older adults/);
  assert.match(query, /walking/);
  assert.match(query, /hot weather/);
  assert.match(query, /UV exposure/);
  assert.match(query, /activity timing/);
  assert.match(query, /hydration/);
  assert.match(query, /shade/);
  assert.doesNotMatch(query, /31|33|8/);
});

test("Gemini receives facts and evidence but can return only explanatory fields", async () => {
  const requests = [];
  const result = await generateRagRecommendation(
    { structuredFacts: facts, evidence: [evidenceRows[0]] },
    generationOptions(validExplanation, requests)
  );
  const request = requests[0];
  const input = JSON.parse(request.contents);

  assert.equal(requests.length, 1);
  assert.deepEqual(Object.keys(input), ["STRUCTURED_FACTS", "RAG_EVIDENCE"]);
  assert.equal(input.STRUCTURED_FACTS.environment.peakTemperatureC, 31);
  assert.equal(input.STRUCTURED_FACTS.environment.peakUvIndex, 8);
  assert.equal(input.STRUCTURED_FACTS.alternative.startTime, facts.alternative.startTime);
  assert.equal(input.RAG_EVIDENCE[0].chunkId, "RAG-019-C001");
  assert.deepEqual(Object.keys(RAG_OUTPUT_SCHEMA.properties), [
    "why",
    "practicalActions",
  ]);
  assert.deepEqual(RAG_OUTPUT_SCHEMA.required, ["why", "practicalActions"]);
  assert.equal(request.config.responseJsonSchema, RAG_OUTPUT_SCHEMA);
  assert.equal(result._source, "gemini");
  assert.deepEqual(result.why, validExplanation.why);
  assert.deepEqual(result.practicalActions, validExplanation.practicalActions);
});

test("factual and decision fields always come from backend data", async () => {
  const input = buildRagLlmInput({ structuredFacts: facts, evidence: evidenceRows.slice(0, 2) });
  const fallback = getRagDeterministicFallback(input);
  const attemptedOverrides = {
    ...validExplanation,
    summary: "Invented summary.",
    recommendation: "Invented recommendation.",
    alternativeTimeExplanation: "Try 11:00 AM.",
    evidenceChunkIds: ["INVENTED"],
    limitations: "Invented limitation.",
  };
  const result = await generateRagRecommendation(
    { structuredFacts: facts, evidence: evidenceRows.slice(0, 2) },
    generationOptions(attemptedOverrides)
  );

  for (const field of [
    "summary",
    "recommendation",
    "alternativeTimeExplanation",
    "evidenceChunkIds",
    "limitations",
  ]) {
    assert.deepEqual(result[field], fallback[field]);
  }
  assert.match(result.summary, /2:00 PM/);
  assert.match(result.summary, /31°C/);
  assert.match(result.summary, /UV 8/);
  assert.match(result.alternativeTimeExplanation, /24°C apparent temperature/);
  assert.match(result.alternativeTimeExplanation, /UV 3/);
  assert.deepEqual(result.evidenceChunkIds, ["RAG-019-C001", "RAG-019-C002"]);
  assert.doesNotMatch(JSON.stringify(result), /Invented|11:00 AM/);
});

test("invalid why falls back without replacing valid Gemini actions or regenerating", async () => {
  const requests = [];
  const invalidWhy = {
    ...validExplanation,
    why: ["The forecast is 31°C.", validExplanation.why[1]],
  };
  const fallback = getRagDeterministicFallback(
    buildRagLlmInput({ structuredFacts: facts, evidence: [evidenceRows[0]] })
  );
  const { result, errors } = await captureErrors(() =>
    generateRagRecommendation(
      { structuredFacts: facts, evidence: [evidenceRows[0]] },
      generationOptions(invalidWhy, requests)
    )
  );

  assert.equal(requests.length, 1);
  assert.deepEqual(result.why, fallback.why);
  assert.deepEqual(result.practicalActions, validExplanation.practicalActions);
  assert.equal(result._source, "gemini");
  assert.deepEqual(errors, [
    "[Gemini RAG] why rejected -> reason=contains forecast fact",
    "[Gemini RAG] field fallback -> why",
  ]);
  assert.doesNotMatch(errors.join("\n"), /correction/);
});

test("invalid practicalActions falls back without replacing valid Gemini why", async () => {
  const invalidActions = {
    ...validExplanation,
    practicalActions: validExplanation.practicalActions.slice(0, 2),
  };
  const fallback = getRagDeterministicFallback(
    buildRagLlmInput({ structuredFacts: facts, evidence: [evidenceRows[0]] })
  );
  const { result, errors } = await captureErrors(() =>
    generateRagRecommendation(
      { structuredFacts: facts, evidence: [evidenceRows[0]] },
      generationOptions(invalidActions)
    )
  );

  assert.deepEqual(result.why, validExplanation.why);
  assert.deepEqual(result.practicalActions, fallback.practicalActions);
  assert.equal(result._source, "gemini");
  assert.deepEqual(errors, [
    "[Gemini RAG] practicalActions rejected -> reason=invalid count",
    "[Gemini RAG] field fallback -> practicalActions",
  ]);
});

test("both invalid explanatory fields fall back and source is fallback", async () => {
  const invalid = { why: [], practicalActions: ["The activity is safe."] };
  const fallback = getRagDeterministicFallback(
    buildRagLlmInput({ structuredFacts: facts, evidence: [evidenceRows[0]] })
  );
  const { result, errors } = await captureErrors(() =>
    generateRagRecommendation(
      { structuredFacts: facts, evidence: [evidenceRows[0]] },
      generationOptions(invalid)
    )
  );

  assert.deepEqual(result.why, fallback.why);
  assert.deepEqual(result.practicalActions, fallback.practicalActions);
  assert.equal(result._source, "fallback");
  assert.deepEqual(errors, [
    "[Gemini RAG] why rejected -> reason=invalid count",
    "[Gemini RAG] field fallback -> why",
    "[Gemini RAG] practicalActions rejected -> reason=invalid count",
    "[Gemini RAG] field fallback -> practicalActions",
  ]);
});

test("provider unavailability keeps deterministic fields and explanatory fallback", async () => {
  let calls = 0;
  const { result, errors } = await captureErrors(() =>
    generateRagRecommendation(
      { structuredFacts: facts, evidence: [evidenceRows[0]] },
      {
        model: "test-model",
        client: {
          models: {
            generateContent: async () => {
              calls += 1;
              const error = new Error("provider rejected request");
              error.status = 400;
              throw error;
            },
          },
        },
        includeSource: true,
      }
    )
  );

  assert.equal(calls, 1);
  assert.equal(result._source, "fallback");
  assert.match(result.summary, /2:00 PM.*31°C.*UV 8/);
  assert.deepEqual(result.evidenceChunkIds, ["RAG-019-C001"]);
  assert.deepEqual(errors.slice(-2), [
    "[Gemini RAG] field fallback -> why",
    "[Gemini RAG] field fallback -> practicalActions",
  ]);
});

test("retryable provider errors remain bounded at three attempts", async () => {
  let attempts = 0;
  const { result, errors } = await captureErrors(() =>
    generateRagRecommendation(
      { structuredFacts: facts, evidence: [evidenceRows[0]] },
      {
        model: "test-model",
        client: {
          models: {
            generateContent: async () => {
              attempts += 1;
              const error = new Error("provider 503");
              error.status = 503;
              throw error;
            },
          },
        },
        includeSource: true,
      }
    )
  );

  assert.equal(attempts, 3);
  assert.equal(result._source, "fallback");
  assert.equal(errors.filter((message) => /attempt [123] failed/.test(message)).length, 3);
  assert.doesNotMatch(errors.join("\n"), /attempt 4|correction/);
  assert.match(errors[3], /returning deterministic fallback after 3 attempts/);
});

test("429 retries can recover within the same three-attempt provider bound", async () => {
  let attempts = 0;
  const client = {
    models: {
      generateContent: async () => {
        attempts += 1;
        if (attempts < 3) {
          const error = new Error("provider 429");
          error.status = 429;
          throw error;
        }
        return { text: JSON.stringify(validExplanation) };
      },
    },
  };
  const { result } = await captureErrors(() =>
    generateRagRecommendation(
      { structuredFacts: facts, evidence: [evidenceRows[0]] },
      { model: "test-model", client, includeSource: true }
    )
  );
  assert.equal(attempts, 3);
  assert.equal(result._source, "gemini");
});

test("invalid JSON falls back without validation regeneration", async () => {
  let calls = 0;
  const { result, errors } = await captureErrors(() =>
    generateRagRecommendation(
      { structuredFacts: facts, evidence: [evidenceRows[0]] },
      {
        model: "test-model",
        client: {
          models: {
            generateContent: async () => {
              calls += 1;
              return { text: "not valid JSON" };
            },
          },
        },
        includeSource: true,
      }
    )
  );
  assert.equal(calls, 1);
  assert.equal(result._source, "fallback");
  assert.match(errors[0], /^\[Gemini RAG\] invalid JSON response -> SyntaxError:/);
  assert.doesNotMatch(errors.join("\n"), /correction/);
});

test("missing response text logs only its type and falls back", async () => {
  const { result, errors } = await captureErrors(() =>
    generateRagRecommendation(
      { structuredFacts: facts, evidence: [evidenceRows[0]] },
      {
        model: "test-model",
        client: {
          models: {
            generateContent: async () => ({
              text: undefined,
              secret: "do-not-log",
            }),
          },
        },
        includeSource: true,
      }
    )
  );
  assert.equal(result._source, "fallback");
  assert.equal(errors[0], "[Gemini RAG] response text unavailable -> type=undefined");
  assert.doesNotMatch(errors.join("\n"), /do-not-log/);
});

test("field validators retain leakage, citation, safety and medical safeguards", () => {
  const input = buildRagLlmInput({ structuredFacts: facts, evidence: evidenceRows });
  assert.equal(getRagLlmOutputRejectionReason(validExplanation, input), null);
  assert.deepEqual(validateRagLlmOutput(validExplanation, input), validExplanation);

  const cases = [
    ["why contains forecast fact", { ...validExplanation, why: ["The forecast is 31°C.", validExplanation.why[1]] }],
    ["why contains forecast fact", { ...validExplanation, why: ["The forecast is UV 7.", validExplanation.why[1]] }],
    ["why contains evidence reference", { ...validExplanation, why: ["RAG-019 title supports this action.", validExplanation.why[1]] }],
    ["why contains evidence reference", { ...validExplanation, why: ["According to a study, this action helps.", validExplanation.why[1]] }],
    ["why contains unsupported safety claim", { ...validExplanation, why: ["This activity is safe.", validExplanation.why[1]] }],
    ["why contains unsupported comfort claim", { ...validExplanation, why: ["Conditions are in a comfortable range.", validExplanation.why[1]] }],
    ["why contains medical advice", { ...validExplanation, why: ["This is medical advice for treatment.", validExplanation.why[1]] }],
    ["why contains medical advice", { ...validExplanation, why: ["Consult your doctor about these symptoms.", validExplanation.why[1]] }],
    ["practicalActions contains exact fluid amount", { ...validExplanation, practicalActions: ["Drink 500 ml of water.", ...validExplanation.practicalActions.slice(1)] }],
    ["practicalActions invalid count", { ...validExplanation, practicalActions: validExplanation.practicalActions.slice(0, 2) }],
  ];
  for (const [reason, value] of cases) {
    assert.equal(getRagLlmOutputRejectionReason(value, input), reason);
    assert.equal(validateRagLlmOutput(value, input), null);
  }
});

test("prompt and response shape preserve the narrowed Hybrid RAG contract", async () => {
  assert.match(RAG_SYSTEM_INSTRUCTION, /STRUCTURED_FACTS are authoritative/);
  assert.match(RAG_SYSTEM_INSTRUCTION, /provide only why and practicalActions/);
  assert.doesNotMatch(RAG_SYSTEM_INSTRUCTION, /summaryFacts|evidenceChunkIds is metadata/);
  const result = await generateRagRecommendation(
    { structuredFacts: facts, evidence: [evidenceRows[0]] },
    generationOptions(validExplanation)
  );
  assert.deepEqual(Object.keys(result), [
    "summary",
    "recommendation",
    "why",
    "practicalActions",
    "alternativeTimeExplanation",
    "evidenceChunkIds",
    "limitations",
    "_source",
  ]);
});

test("deterministic alternative explanation is null without a backend alternative", async () => {
  const noAlternative = { ...facts, alternative: { recommended: false } };
  const result = await generateRagRecommendation(
    { structuredFacts: noAlternative, evidence: [evidenceRows[0]] },
    generationOptions({
      ...validExplanation,
      alternativeTimeExplanation: "Try 11:00 AM.",
    })
  );
  assert.equal(result.alternativeTimeExplanation, null);
  assert.equal(result.recommendation, "Plan around the available forecast for this activity.");
});

test("missing UV is omitted from deterministic output", async () => {
  const withoutUv = {
    ...facts,
    environment: {
      ...facts.environment,
      peakUvIndex: null,
      uvCategory: "UNAVAILABLE",
      sunProtectionRecommended: false,
    },
    alternative: { recommended: false },
  };
  const result = await generateRagRecommendation(
    { structuredFacts: withoutUv, evidence: [] },
    generationOptions(validExplanation)
  );
  assert.match(result.summary, /31°C/);
  assert.doesNotMatch(result.summary, /UV/);
});

test("retrieval failure preserves correct structured fallback fields", async () => {
  const { result } = await captureErrors(() =>
    buildHybridRecommendation({}, facts, {
      retrieval: {
        client: {
          models: {
            embedContent: async () => {
              throw new Error("database or embedding unavailable");
            },
          },
        },
      },
    })
  );
  assert.equal(result.ragStatus, "unavailable");
  assert.equal(result.recommendationStatus, "evidence_unavailable");
  assert.match(result.language.summary, /2:00 PM.*31°C.*UV 8/);
  assert.match(result.language.alternativeTimeExplanation, /24°C.*UV 3/);
  assert.deepEqual(result.language.evidenceChunkIds, []);
});

test("Gemini failure keeps retrieved evidence metadata available", async () => {
  const pool = { query: async () => ({ rows: evidenceRows }) };
  const { result } = await captureErrors(() =>
    buildHybridRecommendation(pool, facts, {
      retrieval: { client: embeddingClient(), candidateLimit: 6, finalLimit: 5 },
      generation: {
        model: "test-model",
        client: {
          models: {
            generateContent: async () => {
              throw new Error("Gemini unavailable");
            },
          },
        },
      },
    })
  );
  assert.equal(result.ragStatus, "available");
  assert.equal(result.recommendationStatus, "fallback");
  assert.equal(result.evidence.length, 5);
  assert.deepEqual(
    result.language.evidenceChunkIds,
    result.evidence.map((item) => item.chunkId)
  );
});
