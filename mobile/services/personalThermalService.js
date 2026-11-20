import {
  getStoredFeedback,
} from "./feedbackStorageService";

// Get saved user feedback records.


/* =========================================================
   FEEDBACK SCORE

   These match the population model classes:

   0 = Not warm / OK
   1 = Warm
   2 = Too hot
========================================================= */

// Convert feedback answers into numeric scores.

const FEEDBACK_SCORES = {
  not_warm: 0,
  warm: 1,
  too_hot: 2,
};


/* =========================================================
   PRIOR STRENGTH

   Controls how quickly personal feedback affects
   the population model.

   Larger value = slower personalization.
========================================================= */

// Used to reduce the effect of small amounts of feedback.

const PRIOR_STRENGTH = 5;


/* =========================================================
   CALCULATE PERSONAL THERMAL PROFILE
========================================================= */

// Calculate the user's personal thermal bias.

export function getPersonalThermalProfile() {

  // Load all stored feedback.
  const feedback =
    getStoredFeedback();


  /*
   * Only use feedback records that contain
   * a valid population-model severity score.
   *
   * Older feedback records without this field
   * will automatically be ignored.
   */

  // Keep only valid feedback records.
  const validFeedback =
    feedback.filter((item) => {

      // Get the population model severity score.
      const severityScore =
        item?.populationThermal
          ?.severityScore;

      // Check that both the answer and severity score are valid.
      return (
        Object.prototype.hasOwnProperty.call(
          FEEDBACK_SCORES,
          item?.answer
        ) &&
        typeof severityScore === "number" &&
        Number.isFinite(
          severityScore
        )
      );
    });


  /*
   * Cold start:
   * no valid feedback yet.
   */

  // Return no personalization when there is no feedback.
  if (
    validFeedback.length === 0
  ) {
    return {
      feedbackCount: 0,
      meanError: 0,
      shrinkageWeight: 0,
      personalBias: 0,
    };
  }


  /*
   * Calculate prediction error for each record.
   *
   * Example:
   *
   * User answer = Warm = 1
   * Population severity = 0.2
   *
   * Error = 1 - 0.2 = +0.8
   */

  // Calculate the difference between user feeling and model prediction.
  const errors =
    validFeedback.map((item) => {

      // Convert the user's answer into 0, 1, or 2.
      const actualScore =
        FEEDBACK_SCORES[
          item.answer
        ];

      // Get the population model prediction.
      const populationScore =
        item.populationThermal
          .severityScore;

      // Positive = user felt hotter than predicted.
      // Negative = user felt cooler than predicted.
      return (
        actualScore -
        populationScore
      );
    });


  // Add all prediction errors together.
  const errorSum =
    errors.reduce(
      (total, error) =>
        total + error,
      0
    );


  // Calculate the average prediction error.
  const meanError =
    errorSum /
    errors.length;


  /*
   * Shrinkage:
   *
   * One feedback should have only a small effect.
   * More feedback increases confidence.
   *
   * n / (n + PRIOR_STRENGTH)
   */

  // Calculate how much confidence to give the feedback.
  const shrinkageWeight =
    validFeedback.length /
    (
      validFeedback.length +
      PRIOR_STRENGTH
    );


  // Reduce the mean error based on the amount of feedback.
  const personalBias =
    meanError *
    shrinkageWeight;


  // Return the user's thermal profile.
  return {
    feedbackCount:
      validFeedback.length,

    meanError,

    shrinkageWeight,

    personalBias,
  };
}


/* =========================================================
   APPLY PERSONAL BIAS
========================================================= */

// Apply the user's personal bias to a population severity score.

export function applyPersonalThermalBias(
  populationSeverityScore
) {

  // Reject invalid population severity scores.
  if (
    typeof populationSeverityScore !==
      "number" ||
    !Number.isFinite(
      populationSeverityScore
    )
  ) {
    return null;
  }


  // Get the latest personal thermal bias.
  const {
    personalBias,
  } =
    getPersonalThermalProfile();


  // Add personal bias to the population prediction.
  const personalizedScore =
    populationSeverityScore +
    personalBias;


  /*
   * Keep score inside the model's 0-2 range.
   */

  // Prevent the personalized score going below 0 or above 2.
  return Math.max(
    0,
    Math.min(
      2,
      personalizedScore
    )
  );
}