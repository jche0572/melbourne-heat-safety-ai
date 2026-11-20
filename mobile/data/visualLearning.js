// Content from Visual Learning Contents.pdf; PDF spacing is normalised.
// tapArea values are percentages of the full image. Item indexes start at zero.
// Keep activities in display order; stable IDs are used for shared completion and knowledge progress.
// Each record contains overview labels, instructions, an image, answer rules, and feedback.
// Tap activities use a correct rectangle; item activities require a complete set of selected indexes.
export const visualActivities = [
  {
    // Unique activity ID used to remember completion independently of its array position.
    "id": 1,
    // Category text must match the overview group names to place this activity in the correct group.
    "category": "Spot the Risk",
    "name": "No Hat",
    // A gentle prompt after three wrong submissions, without naming the correct selection.
    "hint": "Sun protection needs to cover more than just the eyes.",
    "title": "Spot the Risk",
    "description": "Greg is waiting for a tram on a hot and sunny day. Tap the part of the image that shows a UV risk.",
    "image": require("../assets/visual-learning/no-hat.png"),
    // Original image width divided by height keeps percentage tap targets aligned when resized.
    "aspectRatio": 1.4947089947089947,
    // Use image tapping: the target rectangle is correct and taps elsewhere give retry feedback.
    "type": "tap",
    // Accessible description of the correct tap target used by the image interaction control.
    "correctInteraction": "Tap Greg’s uncovered head.",
    // Correct rectangle: left/top locate its corner, and width/height set its size, all in image percentages.
    "tapArea": {
      "left": 29,
      "top": 22,
      "width": 15,
      "height": 21
    },
    // Show this explanation after success and when reopening this completed activity.
    "correctFeedback": "Good choice! Greg is not wearing a hat. A broad-brimmed hat can help protect the head, face, ears and neck from UV exposure.",
    // Show this hint after a wrong answer; activities without this field use the screen fallback message.
    "incorrectFeedback": "Try again. Look for something Greg is missing that could help protect him from the sun."
  },
  {
    // Unique activity ID used to remember completion independently of its array position.
    "id": 2,
    // Category text must match the overview group names to place this activity in the correct group.
    "category": "Spot the Risk",
    "name": "Standing in Direct Sun",
    // A gentle prompt after three wrong submissions, without naming the correct selection.
    "hint": "Compare how much sunlight reaches different parts of this scene.",
    "title": "Spot the Risk",
    "description": "Greg is waiting outside on a hot day. Tap the part of the image that shows the heat or uv risk.",
    "image": require("../assets/visual-learning/standing-in-direct-sun.png"),
    // Original image width divided by height keeps percentage tap targets aligned when resized.
    "aspectRatio": 1.5035128805620608,
    // Use image tapping: the target rectangle is correct and taps elsewhere give retry feedback.
    "type": "tap",
    // Accessible description of the correct tap target used by the image interaction control.
    "correctInteraction": "Tap Greg standing in the exposed sunny area.",
    // Correct rectangle: left/top locate its corner, and width/height set its size, all in image percentages.
    "tapArea": {
      "left": 28,
      "top": 19,
      "width": 26,
      "height": 77
    },
    // Show this explanation after success and when reopening this completed activity.
    "correctFeedback": "Good choice! Greg is standing in direct sun even though shade is available nearby. Using available shade can reduce direct heat and UV exposure.",
    // Show this hint after a wrong answer; activities without this field use the screen fallback message.
    "incorrectFeedback": "Try again. Compare where Greg is standing with the shaded area nearby."
  },
  {
    // Unique activity ID used to remember completion independently of its array position.
    "id": 3,
    // Category text must match the overview group names to place this activity in the correct group.
    "category": "Spot the Risk",
    "name": "No Water Available",
    // A gentle prompt after three wrong submissions, without naming the correct selection.
    "hint": "Think about what the body loses through sweating.",
    "title": "Spot the Risk",
    "description": "Greg is spending time outdoors on a hot day. Tap the part of the image that shows what could help him prepare better for the heat.",
    "image": require("../assets/visual-learning/no-water-available.png"),
    // Original image width divided by height keeps percentage tap targets aligned when resized.
    "aspectRatio": 1.8824742268041237,
    // Use image tapping: the target rectangle is correct and taps elsewhere give retry feedback.
    "type": "tap",
    // Accessible description of the correct tap target used by the image interaction control.
    "correctInteraction": "Tap the drinking fountain.",
    // Correct rectangle: left/top locate its corner, and width/height set its size, all in image percentages.
    "tapArea": {
      "left": 76,
      "top": 31,
      "width": 23,
      "height": 68
    },
    // Show this explanation after success and when reopening this completed activity.
    "correctFeedback": "Good choice! Having access to drinking water can help Greg stay hydrated while he is outdoors in hot conditions.",
    // Show this hint after a wrong answer; activities without this field use the screen fallback message.
    "incorrectFeedback": "Try again. Look for something nearby that could help Greg stay hydrated."
  },
  {
    // Unique activity ID used to remember completion independently of its array position.
    "id": 4,
    // Category text must match the overview group names to place this activity in the correct group.
    "category": "Choose What to Bring",
    "name": "Hot and Sunny Day",
    // A gentle prompt after three wrong submissions, without naming the correct selection.
    "hint": "Consider both sun exposure and staying comfortable in the heat.",
    "title": "What Should Greg Bring?",
    "description": "Greg is preparing to go outside on a hot and sunny day. Tap all the items that would help him prepare for heat and UV.",
    "image": require("../assets/visual-learning/hot-and-sunny-day.png"),
    // Original image width divided by height keeps percentage tap targets aligned when resized.
    "aspectRatio": 2.1408045977011496,
    // Use multiple item selections followed by the Check Answer button.
    "type": "items",
    // Display these choices in order; their zero-based positions are the indexes checked by the screen.
    "items": [
      "Broad-brimmed hat",
      "sunglasses",
      "sunscreen",
      "water bottle",
      "lightweight shirt",
      "dark jacket"
    ],
    // Keep the source answer labels for reference; the screen checks correctItemIndexes, not these labels.
    "correctSelections": [
      "Hat",
      "sunglasses",
      "sunscreen",
      "water bottle"
    ],
    // Select exactly these item positions with no extra choices; the order of selection does not matter.
    "correctItemIndexes": [
      0,
      1,
      2,
      3
    ],
    // Show this explanation after success and when reopening this completed activity.
    "correctFeedback": "Good choice! These items help Greg prepare for both sun exposure and hot conditions."
  },
  {
    // Unique activity ID used to remember completion independently of its array position.
    "id": 5,
    // Category text must match the overview group names to place this activity in the correct group.
    "category": "Choose What to Bring",
    "name": "Very High UV",
    // A gentle prompt after three wrong submissions, without naming the correct selection.
    "hint": "Think about whether one type of sun protection is enough.",
    "title": "Prepare for High UV",
    "description": "The UV Index is very high. Tap the items Greg should use for sun protection before going outside.",
    "image": require("../assets/visual-learning/very-high-uv.png"),
    // Original image width divided by height keeps percentage tap targets aligned when resized.
    "aspectRatio": 1.9096638655462186,
    // Use multiple item selections followed by the Check Answer button.
    "type": "items",
    // Display these choices in order; their zero-based positions are the indexes checked by the screen.
    "items": [
      "Broad-brimmed hat",
      "sunglasses",
      "sunscreen",
      "lightweight long-sleeved shirt",
      "cap"
    ],
    // Keep the source answer labels for reference; the screen checks correctItemIndexes, not these labels.
    "correctSelections": [
      "Hat",
      "sunglasses",
      "sunscreen",
      "lightweight protective shirt"
    ],
    // Select exactly these item positions with no extra choices; the order of selection does not matter.
    "correctItemIndexes": [
      0,
      1,
      2,
      3
    ],
    // Show this explanation after success and when reopening this completed activity.
    "correctFeedback": "Good choice! Using several forms of sun protection together provides better UV protection than relying on only one item."
  },
  {
    // Unique activity ID used to remember completion independently of its array position.
    "id": 6,
    // Category text must match the overview group names to place this activity in the correct group.
    "category": "Choose What to Bring",
    "name": "Hot Weather Walk",
    // A gentle prompt after three wrong submissions, without naming the correct selection.
    "hint": "Choose items that suit moving your body in hot weather.",
    "title": "Prepare for the Heat",
    "description": "Greg is going for a walk on a very hot day. Tap the items that would help him prepare for the heat.",
    "image": require("../assets/visual-learning/hot-weather-walk.png"),
    // Original image width divided by height keeps percentage tap targets aligned when resized.
    "aspectRatio": 1.9501312335958005,
    // Use multiple item selections followed by the Check Answer button.
    "type": "items",
    // Display these choices in order; their zero-based positions are the indexes checked by the screen.
    "items": [
      "Water bottle",
      "broad-brimmed hat",
      "sunglasses",
      "lightweight shirt",
      "light towel",
      "thick jacket"
    ],
    // Keep the source answer labels for reference; the screen checks correctItemIndexes, not these labels.
    "correctSelections": [
      "Water bottle",
      "lightweight shirt",
      "broad-brimmed hat"
    ],
    // Select exactly these item positions with no extra choices; the order of selection does not matter.
    "correctItemIndexes": [
      0,
      1,
      3
    ],
    // Show this explanation after success and when reopening this completed activity.
    "correctFeedback": "Good choice! Water, lightweight clothing and sun protection are practical choices for hot outdoor conditions."
  },
  {
    // Unique activity ID used to remember completion independently of its array position.
    "id": 7,
    // Category text must match the overview group names to place this activity in the correct group.
    "category": "Find Cooling Area / Shade",
    "name": "Choose the Shaded Seat",
    // A gentle prompt after three wrong submissions, without naming the correct selection.
    "hint": "Compare how much sunlight reaches each resting place.",
    "title": "Find a Cooler Place to Rest",
    "description": "Greg wants to sit down for a break. Tap the place that provides more shade.",
    "image": require("../assets/visual-learning/choose-the-shaded-seat.png"),
    // Original image width divided by height keeps percentage tap targets aligned when resized.
    "aspectRatio": 2.1809523809523808,
    // Use image tapping: the target rectangle is correct and taps elsewhere give retry feedback.
    "type": "tap",
    // Accessible description of the correct tap target used by the image interaction control.
    "correctInteraction": "Tap the shaded bench.",
    // Correct rectangle: left/top locate its corner, and width/height set its size, all in image percentages.
    "tapArea": {
      "left": 54,
      "top": 45,
      "width": 45,
      "height": 53
    },
    // Show this explanation after success and when reopening this completed activity.
    "correctFeedback": "Good choice! The shaded bench reduces direct sun exposure while Greg rests."
  },
  {
    // Unique activity ID used to remember completion independently of its array position.
    "id": 8,
    // Category text must match the overview group names to place this activity in the correct group.
    "category": "Find Cooling Area / Shade",
    "name": "Find an Indoor Cooling Area",
    // A gentle prompt after three wrong submissions, without naming the correct selection.
    "hint": "Look for a place that offers a break from outdoor heat.",
    "title": "Find a Cooling Area",
    "description": "Greg wants to take a break from the heat. Tap the place where he can move indoors to a cooler environment.",
    "image": require("../assets/visual-learning/indoor-cooling-area.png"),
    // Original image width divided by height keeps percentage tap targets aligned when resized.
    "aspectRatio": 1.974025974025974,
    // Use image tapping: the target rectangle is correct and taps elsewhere give retry feedback.
    "type": "tap",
    // Accessible description of the correct tap target used by the image interaction control.
    "correctInteraction": "Tap the building entrance.",
    // Correct rectangle: left/top locate its corner, and width/height set its size, all in image percentages.
    "tapArea": {
      "left": 45,
      "top": 33,
      "width": 52,
      "height": 64
    },
    // Show this explanation after success and when reopening this completed activity.
    "correctFeedback": "Good choice! Moving into a cooler indoor environment can help Greg take a break from hot outdoor conditions."
  },
  {
    // Unique activity ID used to remember completion independently of its array position.
    "id": 9,
    // Category text must match the overview group names to place this activity in the correct group.
    "category": "Find Cooling Area / Shade",
    "name": "Choose the Shaded Route",
    // A gentle prompt after three wrong submissions, without naming the correct selection.
    "hint": "Compare how exposed you would be along each route.",
    "title": "Choose the Lower-Exposure Route",
    "description": "Greg has two ways to continue his walk. Tap the route with more shade.",
    "image": require("../assets/visual-learning/shaded-route.png"),
    // Original image width divided by height keeps percentage tap targets aligned when resized.
    "aspectRatio": 2.041002277904328,
    // Use image tapping: the target rectangle is correct and taps elsewhere give retry feedback.
    "type": "tap",
    // Accessible description of the correct tap target used by the image interaction control.
    "correctInteraction": "Tap the tree-covered path.",
    // Correct rectangle: left/top locate its corner, and width/height set its size, all in image percentages.
    "tapArea": {
      "left": 0,
      "top": 43,
      "width": 41,
      "height": 57
    },
    // Show this explanation after success and when reopening this completed activity.
    "correctFeedback": "Good choice! The shaded route can reduce Greg’s direct sun exposure while walking."
  }
];
