import { visualActivities } from "../data/visualLearning";
import { scenarios } from "../data/scenarios";

export const SCENARIO_UNLOCK_MESSAGE = "Complete all 9 Visual Learning activities to unlock.";
export const QUIZ_UNLOCK_MESSAGE = "Complete Visual Learning and all 3 scenarios to unlock.";

// Count only known activity IDs once, so duplicates or unrelated IDs cannot unlock a module.
export function getLearningAccess(completedVisualActivityIds = [], completedScenarioIds = []) {
  const completedVisualCount = visualActivities.filter((activity) => completedVisualActivityIds.includes(activity.id)).length;
  const completedScenarioCount = scenarios.filter((scenario) => completedScenarioIds.includes(scenario.id)).length;
  const visualComplete = completedVisualCount === visualActivities.length;
  const scenariosComplete = completedScenarioCount === scenarios.length;
  return {
    completedVisualCount,
    completedScenarioCount,
    scenarioUnlocked: visualComplete,
    quizUnlocked: visualComplete && scenariosComplete,
  };
}
