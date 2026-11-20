// Import Gemini client and thinking-level setting.
const {
  GoogleGenAI,
  ThinkingLevel,
} = require("@google/genai");


// Instructions that control what the AI is allowed to do.
const SYSTEM_INSTRUCTION = `You are the user-facing language layer for SolAdapt.

SolAdapt supports adults aged 65 and over in Melbourne and provides environmental decision support for outdoor activity planning. It is not a medical diagnosis or treatment service.

The application has already calculated all environmental values, heat and UV classifications, sun-protection decisions, and alternative-time decisions. Treat those deterministic results as authoritative.

Your role is only to explain the supplied results in short, clear and practical language.

Rules:
- Never invent weather or forecast values.
- Never change the supplied heat or UV category.
- Never change the sun-protection decision.
- Never choose or suggest a different alternative time.
- Never calculate a heat threshold or medical risk level.
- Never describe a time as medically safe or unsafe.
- Do not provide medical diagnosis or treatment advice.
- Use simple language suitable for older adults.
- Avoid technical terminology.
- If sunProtectionRecommended is true, provide practical sun-protection advice.
- If an alternative time exists, explain only the supplied alternative.
- If no alternative exists, alternativeTimeExplanation must be null.
- Do not mention algorithms, prompts, databases, scores or implementation details.

Return only a JSON object with exactly these fields:
- shortRecommendation: a non-empty string
- practicalAdvice: 2 to 4 concise non-empty strings
- alternativeTimeExplanation: a string or null`;


// Define the exact JSON structure Gemini must return.
const OUTPUT_SCHEMA = Object.freeze({

  // The top-level response must be an object.
  type: "object",

  // Define each allowed property.
  properties: {

    // Short recommendation must be text.
    shortRecommendation: {
      type: "string",
    },

    // Practical advice must be an array of strings.
    practicalAdvice: {
      type: "array",
      items: {
        type: "string",
      },

      // Require at least 2 advice items.
      minItems: 2,

      // Allow no more than 4 advice items.
      maxItems: 4,
    },

    // Alternative-time explanation can be text or null.
    alternativeTimeExplanation: {
      anyOf: [
        { type: "string" },
        { type: "null" },
      ],
    },
  },

  // These three fields must always exist.
  required: [
    "shortRecommendation",
    "practicalAdvice",
    "alternativeTimeExplanation",
  ],

  // Gemini is not allowed to add extra fields.
  additionalProperties: false,
});


// Convert project data into a controlled object to send to the LLM.
function buildLlmInput({ activity, environment, alternative }) {

  // Only treat alternative time as recommended when it is exactly true.
  const alternativeRecommended =
    alternative?.recommended === true;


  // Build the final input structure for Gemini.
  return {

    // Activity information.
    activity: {

      // Use null if location is missing.
      location: activity?.location ?? null,

      // Use null if start time is missing.
      startTime: activity?.startTime ?? null,

      // Use null if end time is missing.
      endTime: activity?.endTime ?? null,
    },


    // Environmental values already calculated by the application.
    environment: {

      // Peak normal temperature.
      peakTemperatureC:
        environment?.peakTemperatureC ?? null,

      // Peak feels-like temperature.
      peakApparentTemperatureC:
        environment?.peakApparentTemperatureC ?? null,

      // Peak UV index.
      peakUvIndex: environment?.peakUvIndex ?? null,

      // Heat category calculated by deterministic logic.
      heatCategory: environment?.heatCategory ?? null,

      // UV category calculated by deterministic logic.
      uvCategory: environment?.uvCategory ?? null,

      // Convert the value into a strict true/false result.
      sunProtectionRecommended:
        environment?.sunProtectionRecommended === true,
    },


    // Alternative-time information.
    alternative: {

      // Store whether an alternative is recommended.
      recommended: alternativeRecommended,

      // Only include the alternative start time if it is recommended.
      startTime: alternativeRecommended
        ? alternative?.startTime ?? null
        : null,

      // Only include the alternative end time if it is recommended.
      endTime: alternativeRecommended
        ? alternative?.endTime ?? null
        : null,

      // Only include alternative apparent temperature when recommended.
      peakApparentTemperatureC: alternativeRecommended
        ? alternative?.peakApparentTemperatureC ?? null
        : null,

      // Only include alternative UV when recommended.
      peakUvIndex: alternativeRecommended
        ? alternative?.peakUvIndex ?? null
        : null,
    },
  };
}


// Check that the AI returned exactly the expected property names.
function hasOnlyExpectedKeys(value) {

  // Define the only allowed keys.
  const expectedKeys = [
    "shortRecommendation",
    "practicalAdvice",
    "alternativeTimeExplanation",
  ];

  // Get all keys returned by the AI.
  const actualKeys = Object.keys(value);


  // Require the same number of keys
  // and make sure every expected key exists.
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => actualKeys.includes(key))
  );
}


// Check whether text contains prohibited "safe" or "unsafe" claims.
function containsProhibitedSafetyClaim(value) {

  // Regex checks for "safe", "unsafe",
  // "medically safe", or "medically unsafe".
  return /\b(?:medically\s+)?(?:safe|unsafe)\b/i.test(value);
}


// Validate Gemini's output before the application uses it.
function validateLlmOutput(value, llmInput) {

  // Make sure the output is a normal object
  // with only the expected keys.
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !hasOnlyExpectedKeys(value)
  ) {

    // null means validation failed.
    return null;
  }


  // Check that shortRecommendation is non-empty text.
  if (
    typeof value.shortRecommendation !== "string" ||
    !value.shortRecommendation.trim()
  ) {
    return null;
  }


  // Reject recommendation text containing prohibited safety claims.
  if (
    containsProhibitedSafetyClaim(value.shortRecommendation)
  ) {
    return null;
  }


  // Validate the practicalAdvice array.
  if (

    // It must be an array.
    !Array.isArray(value.practicalAdvice) ||

    // It must contain at least 2 items.
    value.practicalAdvice.length < 2 ||

    // It cannot contain more than 4 items.
    value.practicalAdvice.length > 4 ||

    // Every advice item must be valid non-empty text
    // and must not contain prohibited safety claims.
    value.practicalAdvice.some(
      (item) =>
        typeof item !== "string" ||
        !item.trim() ||
        containsProhibitedSafetyClaim(item)
    )
  ) {
    return null;
  }


  // Store the alternative explanation for easier checking.
  const alternativeExplanation =
    value.alternativeTimeExplanation;


  // It must either be null or a non-empty string.
  if (
    alternativeExplanation !== null &&
    (typeof alternativeExplanation !== "string" ||
      !alternativeExplanation.trim())
  ) {
    return null;
  }


  // Reject prohibited safety claims in the alternative explanation.
  if (
    alternativeExplanation !== null &&
    containsProhibitedSafetyClaim(alternativeExplanation)
  ) {
    return null;
  }


  // If no alternative was recommended,
  // the AI must not provide an alternative explanation.
  if (
    llmInput?.alternative?.recommended !== true &&
    alternativeExplanation !== null
  ) {
    return null;
  }


  // If an alternative was recommended,
  // the AI must provide an explanation.
  if (
    llmInput?.alternative?.recommended === true &&
    alternativeExplanation === null
  ) {
    return null;
  }


  // Output passed all validation checks.
  return value;
}


// Create a safe recommendation if Gemini cannot be used.
function getDeterministicFallback(llmInput) {

  // Check whether sun protection is required.
  const sunProtectionRecommended =
    llmInput?.environment?.sunProtectionRecommended === true;

  // Check whether an alternative time was recommended.
  const alternativeRecommended =
    llmInput?.alternative?.recommended === true;


  // Return predictable fallback text.
  return {

    // Change the message depending on sun-protection result.
    shortRecommendation: sunProtectionRecommended
      ? "Sun protection is recommended for this activity."
      : "Your activity has been reviewed using the available forecast information.",

    // Give advice based on the sun-protection decision.
    practicalAdvice: sunProtectionRecommended
      ? [
          "Use sun protection.",
          "Reduce time in direct sunlight where possible.",
        ]
      : [
          "Check the forecast before leaving.",
          "Take breaks as needed.",
        ],

    // Only provide alternative-time text if one exists.
    alternativeTimeExplanation: alternativeRecommended
      ? "The supplied alternative time has more suitable forecast heat and UV conditions."
      : null,
  };
}


// Create the Gemini API client.
function createGeminiClient(apiKey) {

  // If there is no API key, Gemini cannot be used.
  if (!apiKey) return null;


  // Create and return the Gemini client.
  return new GoogleGenAI({

    // Use the supplied API key.
    apiKey,

    // Stop the request after 30 seconds.
    httpOptions: {
      timeout: 30000,
    },
  });
}


// Optionally add information showing where the result came from.
function withSource(value, source, includeSource) {

  // If includeSource is true, add _source.
  // Otherwise return the original value unchanged.
  return includeSource ? { ...value, _source: source } : value;
}


// Generate user-friendly recommendation language with Gemini.
async function generateRecommendationLanguage(
  sourceData,
  options = {}
) {

  // Convert project data into the controlled LLM input format.
  const llmInput = buildLlmInput(sourceData);

  // Prepare fallback text in case Gemini fails.
  const fallback = getDeterministicFallback(llmInput);

  // Decide whether to include the result source.
  const includeSource = options.includeSource === true;

  // Use an API key from options first,
  // otherwise use the environment variable.
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;

  // Use a model from options first,
  // otherwise use the environment variable.
  const model = options.model ?? process.env.GEMINI_MODEL;

  // Use a provided client or create a new Gemini client.
  const client = options.client ?? createGeminiClient(apiKey);


  // If Gemini cannot be used,
  // immediately return the deterministic fallback.
  if (!client || !model) {
    return withSource(fallback, "fallback", includeSource);
  }


  // Gemini requests can fail, so use try/catch.
  try {

    // Send the controlled data to Gemini and wait for the response.
    const response = await client.models.generateContent({

      // Select the Gemini model.
      model,

      // Convert the input object into JSON text for Gemini.
      contents: JSON.stringify(llmInput),

      // Configure how Gemini must respond.
      config: {

        // Give Gemini the system rules.
        systemInstruction: SYSTEM_INSTRUCTION,

        // Require JSON output.
        responseMimeType: "application/json",

        // Require the JSON to follow OUTPUT_SCHEMA.
        responseJsonSchema: OUTPUT_SCHEMA,

        // Use low thinking level because this task
        // only rewrites already-calculated results.
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });


    // Get the text returned by Gemini.
    const responseText = response?.text;


    // If Gemini did not return text,
    // use the fallback response.
    if (typeof responseText !== "string") {
      return withSource(fallback, "fallback", includeSource);
    }


    // Convert Gemini's JSON text into a JavaScript object.
    const parsedOutput = JSON.parse(responseText);


    // Check that Gemini's result follows all application rules.
    const validatedOutput = validateLlmOutput(
      parsedOutput,
      llmInput
    );


    // Use Gemini output if validation passed.
    // Otherwise use the deterministic fallback.
    return withSource(
      validatedOutput ?? fallback,

      // Record which source produced the final result.
      validatedOutput ? "gemini" : "fallback",

      includeSource
    );


  // If Gemini, JSON parsing, or anything else fails...
  } catch (_error) {

    // Return the safe deterministic fallback.
    return withSource(fallback, "fallback", includeSource);
  }
}

const RAG_SYSTEM_INSTRUCTION = `You are SolAdapt's user-facing recommendation language layer.

SolAdapt provides environmental decision support for adults aged 65 and over. It is not a medical diagnosis or personalised medical advice service.

The input has two separate sections:
- STRUCTURED_FACTS are authoritative and are supplied only as context for your explanations. Never restate their times, temperatures or UV values.
- RAG_EVIDENCE is explanatory reference material only. It may inform practical actions, but it must never determine current conditions, calculate a better time, or override STRUCTURED_FACTS.

Output contract:
- why contains exactly 2 short sentences/items. Explain why the backend decision fits the supplied deterministic categories and RAG rationale. Do not include numeric forecast facts, the exact alternative time, source information or citations.
- practicalActions contains exactly 3 short actions, one action per item. Do not repeat why text, numeric forecast facts or source information.
- Do not use unsupported labels such as "comfortable range" or "mild conditions" unless that exact label is directly supplied by a deterministic category.
- Never include a paper title, author, organisation, source ID, citation or bibliography.
- Do not diagnose, assess personalised medical risk or give personalised medical advice.
- Do not prescribe an exact fluid amount. Give general hydration considerations only.
- Built-shade evidence is not proof of current tree-canopy shade; say potential shade when relevant.
- Do not use the words safe or unsafe for the activity or time.
- Use short, clear language suitable for older adults.

Return only JSON matching the supplied schema. The backend constructs every factual and decision field; you provide only why and practicalActions.`;

const RAG_STRING_LIMITS = Object.freeze({
  why: 120,
  practicalActions: 100,
});

const RAG_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    why: {
      type: "array",
      items: {
        type: "string",
        minLength: 1,
        maxLength: RAG_STRING_LIMITS.why,
      },
      minItems: 2,
      maxItems: 2,
    },
    practicalActions: {
      type: "array",
      items: {
        type: "string",
        minLength: 1,
        maxLength: RAG_STRING_LIMITS.practicalActions,
      },
      minItems: 3,
      maxItems: 3,
    },
  },
  required: ["why", "practicalActions"],
  additionalProperties: false,
});

function buildRagLlmInput({ structuredFacts, evidence } = {}) {
  const facts = structuredFacts ?? {};
  const alternative = facts.alternative ?? {};
  const alternativeRecommended = alternative.recommended === true;

  return {
    STRUCTURED_FACTS: {
      activity: {
        title: facts.activity?.title ?? null,
        location: facts.activity?.location ?? null,
        description: facts.activity?.description ?? null,
        startTime: facts.activity?.startTime ?? null,
        endTime: facts.activity?.endTime ?? null,
      },
      environment: {
        peakTemperatureC: facts.environment?.peakTemperatureC ?? null,
        peakApparentTemperatureC:
          facts.environment?.peakApparentTemperatureC ?? null,
        peakUvIndex: facts.environment?.peakUvIndex ?? null,
        heatCategory: facts.environment?.heatCategory ?? null,
        uvCategory: facts.environment?.uvCategory ?? null,
        sunProtectionRecommended:
          facts.environment?.sunProtectionRecommended === true,
      },
      alternative: {
        recommended: alternativeRecommended,
        startTime: alternativeRecommended
          ? alternative.startTime ?? null
          : null,
        endTime: alternativeRecommended
          ? alternative.endTime ?? null
          : null,
        peakApparentTemperatureC: alternativeRecommended
          ? alternative.peakApparentTemperatureC ?? null
          : null,
        peakUvIndex: alternativeRecommended
          ? alternative.peakUvIndex ?? null
          : null,
      },
    },
    RAG_EVIDENCE: (Array.isArray(evidence) ? evidence : []).map((row) => ({
      sourceId: row.source_id ?? row.sourceId ?? null,
      chunkId: row.chunk_id ?? row.chunkId ?? null,
      title: row.title ?? null,
      authors: row.authors ?? row.author ?? null,
      organisation: row.organisation ?? null,
      sectionTitle: row.section_title ?? row.sectionTitle ?? null,
      priority: row.priority ?? null,
      limitations: row.limitations ?? [],
      licence: row.licence ?? null,
      canonicalUrl: row.canonical_url ?? row.canonicalUrl ?? null,
      content: row.content ?? null,
    })),
  };
}

function ragFacts(llmInput) {
  return llmInput?.STRUCTURED_FACTS ?? {};
}

function ragEvidence(llmInput) {
  return Array.isArray(llmInput?.RAG_EVIDENCE)
    ? llmInput.RAG_EVIDENCE
    : [];
}

function containsEvidenceReference(value, llmInput) {
  const text = String(value).toLowerCase();
  const names = ragEvidence(llmInput).flatMap((item) => [
    item.sourceId,
    item.title,
    item.authors,
    item.organisation,
  ]);
  return (
    /\b(?:according to|citation|cited|paper|research|source|study)\b|\[\d+\]/i.test(
      value
    ) ||
    names.some(
      (name) =>
        typeof name === "string" &&
        name.trim().length > 2 &&
        text.includes(name.trim().toLowerCase())
    )
  );
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSingleSentence(value) {
  const sentenceEnds = value.match(/[!?。！？]|\.(?=\s|$)/g) ?? [];
  return sentenceEnds.length === 1;
}

function containsNumber(value, number) {
  if (!Number.isFinite(number)) return false;
  const token = escapeRegExp(formatNumber(number));
  return new RegExp(`(?:^|[^\\d.])${token}(?!\\d|\\.\\d)`).test(value);
}

function ragTimes(llmInput) {
  const facts = ragFacts(llmInput);
  return [
    facts.activity?.startTime,
    facts.activity?.endTime,
    facts.alternative?.startTime,
    facts.alternative?.endTime,
  ].map(formatTime).filter(Boolean);
}

function ragForecastNumbers(llmInput) {
  const facts = ragFacts(llmInput);
  const environment = facts.environment ?? {};
  const alternative = facts.alternative ?? {};
  return [
    environment.peakTemperatureC,
    environment.peakApparentTemperatureC,
    environment.peakUvIndex,
    alternative.peakApparentTemperatureC,
    alternative.peakUvIndex,
  ].filter(Number.isFinite);
}

function containsForecastFact(value, llmInput) {
  return (
    /\b\d{1,2}:\d{2}\s?(?:AM|PM)\b|\b\d+(?:\.\d+)?\s*°\s*C\b|\bUV(?:\s+index)?\s*(?:is|of|:)?\s*\d+(?:\.\d+)?\b/i.test(
      value
    ) ||
    ragTimes(llmInput).some((time) => value.includes(time)) ||
    ragForecastNumbers(llmInput).some((number) => containsNumber(value, number))
  );
}

function containsUnsupportedComfortPhrase(value, llmInput) {
  const categories = [
    ragFacts(llmInput).environment?.heatCategory,
    ragFacts(llmInput).environment?.uvCategory,
  ]
    .filter((category) => typeof category === "string")
    .join(" ")
    .toLowerCase();

  return ["comfortable range", "mild conditions"].some(
    (phrase) => value.toLowerCase().includes(phrase) && !categories.includes(phrase)
  );
}

function getRagFieldRejectionReason(value, llmInput, field) {
  const expectedCount = field === "why" ? 2 : 3;
  if (!Array.isArray(value) || value.length !== expectedCount) {
    return "invalid count";
  }
  if (
    value.some(
      (item) =>
        typeof item !== "string" ||
        !item.trim() ||
        item.length > RAG_STRING_LIMITS[field] ||
        !isSingleSentence(item)
    )
  ) {
    return "invalid text";
  }
  if (value.some((item) => containsForecastFact(item, llmInput))) {
    return "contains forecast fact";
  }
  if (value.some(containsProhibitedSafetyClaim)) {
    return "contains unsupported safety claim";
  }
  if (value.some((item) => containsEvidenceReference(item, llmInput))) {
    return "contains evidence reference";
  }
  if (value.some((item) => containsUnsupportedComfortPhrase(item, llmInput))) {
    return "contains unsupported comfort claim";
  }
  if (
    value.some((item) =>
      /\b(?:consult (?:a |your )?doctor|diagnos(?:e|is)|medicat(?:e|ion)|symptoms?|treat(?:ment)?|medical advice|medical risk)\b/i.test(
        item
      )
    )
  ) {
    return "contains medical advice";
  }
  if (
    value.some((item) =>
      /\b\d+(?:\.\d+)?\s*(?:ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|cups?|ounces?|oz)\b/i.test(
        item
      )
    )
  ) {
    return "contains exact fluid amount";
  }
  return null;
}

function getRagLlmOutputRejectionReason(value, llmInput) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "invalid object";
  }
  for (const field of ["why", "practicalActions"]) {
    const reason = getRagFieldRejectionReason(value[field], llmInput, field);
    if (reason) return `${field} ${reason}`;
  }
  return null;
}

function validateRagLlmOutput(value, llmInput) {
  return getRagLlmOutputRejectionReason(value, llmInput) === null
    ? value
    : null;
}

function getRagDeterministicFallback(llmInput) {
  const facts = ragFacts(llmInput);
  const environment = facts.environment ?? {};
  const alternativeRecommended =
    facts.alternative?.recommended === true;
  const plannedTime = formatTime(facts.activity?.startTime);
  const plannedConditions = formatConditions(environment);
  const alternativeConditions = formatConditions({
    peakApparentTemperatureC:
      facts.alternative?.peakApparentTemperatureC,
    peakUvIndex: facts.alternative?.peakUvIndex,
  });
  const categoryReason = (category, subject) => {
    const label = {
      LOW: "low",
      MODERATE: "moderate",
      HIGH: "high",
      EXTREME: "extreme",
    }[String(category).toUpperCase()];
    return label
      ? `The ${subject} category is ${label}; plan around ${subject} exposure.`
      : null;
  };
  const why = [
    categoryReason(environment.heatCategory, "heat"),
    categoryReason(environment.uvCategory, "UV"),
  ].filter(Boolean);

  if (alternativeRecommended && why.length < 2) {
    why.push("The supplied alternative improves at least one forecast condition.");
  }
  if (environment.sunProtectionRecommended === true && why.length < 2) {
    why.push("Sun protection is recommended for this forecast.");
  }
  while (why.length < 2) {
    why.push("The available forecast supports planning with breaks as needed.");
  }

  return {
    summary: plannedConditions
      ? plannedTime
        ? `At ${plannedTime}, the forecast is ${plannedConditions}.`
        : `The available forecast is ${plannedConditions}.`
      : plannedTime
        ? `At ${plannedTime}, forecast details are limited.`
        : "Forecast information is limited for this activity.",
    recommendation: alternativeRecommended
      ? "Consider moving the activity to the supplied alternative time."
      : "Plan around the available forecast for this activity.",
    why: why.slice(0, 2),
    practicalActions: environment.sunProtectionRecommended
      ? [
          "Use sun protection.",
          "Choose potential shade where available.",
          "Bring water and take breaks as needed.",
        ]
      : [
          "Check the forecast before leaving.",
          "Bring water.",
          "Take breaks as needed.",
        ],
    alternativeTimeExplanation: alternativeRecommended
      ? alternativeConditions
        ? `The supplied alternative has ${alternativeConditions}, improving at least one forecast condition.`
        : "The supplied alternative improves at least one forecast condition."
      : null,
    evidenceChunkIds: ragEvidence(llmInput)
      .map((item) => item.chunkId)
      .filter((chunkId) => typeof chunkId === "string"),
    limitations:
      "This is environmental decision support, not medical advice. Conditions do not account for individual health, medicines, hydration status or heat tolerance.",
  };
}

function formatTime(value) {
  const match = typeof value === "string"
    ? value.match(/T(\d{2}):(\d{2})/)
    : null;
  if (!match) return null;
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
}

function formatConditions(environment = {}) {
  const parts = [];
  if (Number.isFinite(environment.peakTemperatureC)) {
    parts.push(`${formatNumber(environment.peakTemperatureC)}°C`);
  } else if (Number.isFinite(environment.peakApparentTemperatureC)) {
    parts.push(`${formatNumber(environment.peakApparentTemperatureC)}°C apparent temperature`);
  }
  if (Number.isFinite(environment.peakUvIndex)) {
    parts.push(`UV ${formatNumber(environment.peakUvIndex)}`);
  }
  return parts.join(" and ");
}

function retryableGeminiError(error) {
  const status = Number(
    error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.code
  );
  return status === 429 || (status >= 500 && status < 600) ||
    /\b(?:429|5\d\d)\b/.test(String(error?.message ?? ""));
}

function safeGeminiDiagnostic(value, fallback = "unknown") {
  const text = String(value ?? fallback)
    .replace(/\s+/g, " ")
    .replace(/A[I]za[0-9A-Za-z_-]{20,}/g, "[REDACTED]")
    .replace(
      /((?:api[_-]?key|key|token|access[_-]?token)\s*[:=]\s*)\S+/gi,
      "$1[REDACTED]"
    );
  return text ? (text.length > 240 ? `${text.slice(0, 237)}...` : text) : fallback;
}

async function requestRagGeneration(client, model, contents) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: RAG_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseJsonSchema: RAG_OUTPUT_SCHEMA,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });
    } catch (error) {
      const retryable = retryableGeminiError(error);
      const diagnostic = {
        status:
          error?.status ??
          error?.statusCode ??
          error?.response?.status ??
          error?.code ??
          "unknown",
        name: error?.name ?? "Error",
        retryable,
        message: safeGeminiDiagnostic(error?.message, "Unknown error"),
      };
      console.error(
        `[Gemini RAG] attempt ${attempt} failed -> ` +
          `status=${safeGeminiDiagnostic(diagnostic.status)} ` +
          `name=${safeGeminiDiagnostic(diagnostic.name, "Error")} ` +
          `retryable=${diagnostic.retryable} message=${diagnostic.message}`
      );

      if (attempt < 3 && retryable) {
        await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** (attempt - 1)));
        continue;
      }

      console.error(
        `[Gemini RAG] returning deterministic fallback after ${attempt} ` +
          `attempt${attempt === 1 ? "" : "s"}.`
      );
      return null;
    }
  }
  return null;
}

function parseRagGenerationResponse(response) {
  const responseText = response?.text;
  if (typeof responseText !== "string") {
    console.error(
      `[Gemini RAG] response text unavailable -> type=${typeof responseText}`
    );
    return undefined;
  }

  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error(
      `[Gemini RAG] invalid JSON response -> ${safeGeminiDiagnostic(
        `${error?.name ?? "SyntaxError"}: ${error?.message ?? "Unknown parse error"}`
      )}`
    );
    return undefined;
  }
}

async function generateRagRecommendation(
  sourceData,
  options = {}
) {
  const llmInput = buildRagLlmInput(sourceData);
  const fallback = getRagDeterministicFallback(llmInput);
  const includeSource = options.includeSource === true;
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const model = options.model ?? process.env.GEMINI_MODEL;
  const client = options.client ?? createGeminiClient(apiKey);
  const fullFallback = () => {
    console.error("[Gemini RAG] field fallback -> why");
    console.error("[Gemini RAG] field fallback -> practicalActions");
    return withSource(fallback, "fallback", includeSource);
  };

  if (!client || !model) {
    return fullFallback();
  }

  const response = await requestRagGeneration(
    client,
    model,
    JSON.stringify(llmInput)
  );
  if (response === null) {
    return fullFallback();
  }
  const parsedOutput = parseRagGenerationResponse(response);
  if (parsedOutput === undefined) {
    return fullFallback();
  }

  const output = { ...fallback };
  let usedGemini = false;
  for (const field of ["why", "practicalActions"]) {
    const reason = getRagFieldRejectionReason(parsedOutput?.[field], llmInput, field);
    if (reason) {
      console.error(`[Gemini RAG] ${field} rejected -> reason=${reason}`);
      console.error(`[Gemini RAG] field fallback -> ${field}`);
    } else {
      output[field] = parsedOutput[field];
      usedGemini = true;
    }
  }

  // Backward compatibility: "gemini" means at least one explanatory field
  // came from Gemini; "fallback" means both explanatory fields fell back.
  return withSource(output, usedGemini ? "gemini" : "fallback", includeSource);
}


// Export these functions/constants so other backend files can use them.
module.exports = {
  OUTPUT_SCHEMA,
  RAG_OUTPUT_SCHEMA,
  RAG_SYSTEM_INSTRUCTION,
  SYSTEM_INSTRUCTION,
  buildLlmInput,
  buildRagLlmInput,
  generateRecommendationLanguage,
  generateRagRecommendation,
  getDeterministicFallback,
  getRagDeterministicFallback,
  getRagLlmOutputRejectionReason,
  validateLlmOutput,
  validateRagLlmOutput,
};
