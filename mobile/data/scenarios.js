// Content from Scenario Learning Contents.pdf. Only PDF spacing and degree symbols are normalised.
// correctOptionIndex uses zero-based array indexes: 0 = Option 1.
// Scenario records provide list details, background context, ordered questions, and completion summaries.
// Navigation and progress use each stable string ID; questions are presented in their array order.
export const scenarios = [
  {
    // Stable scenario ID passed between routes and stored in the shared completion list.
    "id": "market",
    "title": "A Trip to Market",
    image: require("../assets/scenarios/trip-to-market.png"),
    "shortDescription": "Plan a trip to the market safely when the day is hot and UV is very high.",
    "tags": [
      "Heat",
      "UV",
      "Planning"
    ],
    "estimatedTime": "5 mins",
    "longDescription": "It is 11:30 AM on a summer day. The temperature is 31°C and the UV Index is 8 (Very High). You want to walk about 25 minutes to Queen Victoria Market to buy groceries.",
    "activity": "You needs to decide whether to leave now, change the time of his trip, prepare for the conditions, and respond safely if he starts feeling unwell.",
    // Ordered question sequence; finishing the last question marks this scenario complete.
    "questions": [
      {
        "title": "What should you do before deciding to leave?",
        "description": "It is 11:30 AM and the temperature and UV are already high.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "Think about what information you need before judging whether the trip is suitable.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "Go now because the trip is only 25 minutes.",
            "feedback": "This choice may increase your risk. Even a relatively short outdoor trip can expose you to heat and very high UV. Check the conditions before deciding."
          },
          {
            "text": "Check the hourly heat and UV conditions first.",
            "feedback": "Good choice. Checking how heat and UV will change helps you decide whether now is suitable or whether another time would be safer."
          },
          {
            "text": "Only check whether it looks sunny outside.",
            "feedback": "Not quite. You cannot reliably judge UV by how sunny or hot it feels. UV can still be high on cooler or cloudy days."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 1
      },
      {
        "title": "When would you choose to go?",
        "description": "SolAdapt shows that the heat and UV conditions improve later in the day.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "A planned trip does not have to happen at the original time.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "Leave immediately because the trip is already planned.",
            "feedback": "This may not be the safest choice. A planned activity can be changed when conditions are less suitable."
          },
          {
            "text": "Choose the cooler time suggested by SolAdapt.",
            "feedback": "Good choice. Moving an outdoor activity to a cooler time can reduce heat exposure."
          },
          {
            "text": "Wait exactly one hour without checking the conditions again.",
            "feedback": "Not quite. Conditions do not always improve after a fixed amount of time. Check the hourly forecast before choosing a new time."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 1
      },
      {
        "title": "What should you prepare before leaving?",
        "description": "You decide that you still need to make the trip.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "Consider preparation for both the weather and the length of the walk.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "Take water and use sun protection, including protective clothing, sunscreen, a hat, shade where possible and sunglasses.",
            "feedback": "Good choice. This helps you manage both heat and UV exposure during the trip."
          },
          {
            "text": "Take sunglasses only.",
            "feedback": "Not enough protection. Sunglasses protect your eyes, but a combination of sun protection measures is recommended."
          },
          {
            "text": "Take nothing because you will be outside for less than an hour.",
            "feedback": "This choice may increase your risk. Very high UV and hot conditions can still affect you during a short trip."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 0
      },
      {
        "title": "What should you do if you feel lightheaded?",
        "description": "Halfway to the market, you begin to feel lightheaded and unusually tired.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "Feeling unwell during a hot walk is a reason to reassess the activity.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "Keep walking so you can reach the market faster.",
            "feedback": "This choice may increase your risk. Continuing physical activity can worsen heat-related symptoms."
          },
          {
            "text": "Stop in a cool or shaded place, rest and drink water.",
            "feedback": "Good choice. Stop the activity and cool down rather than trying to push through the symptoms."
          },
          {
            "text": "Sit in direct sunlight until you feel better.",
            "feedback": "Not recommended. Move somewhere cool or shaded rather than remaining exposed to heat."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 1
      },
      {
        "title": "Why should you check UV separately from temperature?",
        "description": "The next day feels much cooler.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "Think about whether the air temperature tells the whole story about sun exposure.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "Because UV can still be high even when the weather feels cool or cloudy.",
            "feedback": "Correct. Temperature and UV are different conditions, so both should be checked."
          },
          {
            "text": "Because UV only becomes dangerous when the temperature is above 30°C.",
            "feedback": "Incorrect. High UV does not depend on the day feeling hot."
          },
          {
            "text": "Because UV only matters during heatwaves.",
            "feedback": "Incorrect. UV protection may be required whenever the UV Index reaches 3 or above."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 0
      }
    ],
    // Summary text displayed on the scenario completion screen.
    "completionMessage": "Well done! You planned your trip with both heat and UV in mind.",
    // Main lesson displayed separately to reinforce what the learner should remember.
    "keyTakeaway": "Check heat and UV before leaving, choose a safer time when possible, and prepare with water and sun protection."
  },
  {
    // Stable scenario ID passed between routes and stored in the shared completion list.
    "id": "morning-walk",
    "title": "Morning Walk",
    image: require("../assets/scenarios/morning-walk.png"),
    "shortDescription": "Learn how to prepare for a morning walk as heat and UV conditions begin to rise.",
    "tags": [
      "Heat",
      "UV",
      "Exercise"
    ],
    "estimatedTime": "5 mins",
    "longDescription": "It is 8:30 AM. The temperature is 27°C, but the forecast shows it will reach 35°C later today. The UV Index is currently 5 (Moderate) and is expected to increase. You usually takes a 40-minute morning walk.",
    "activity": "You need to decide whether the walk is suitable, what he should bring, how he can reduce exposure and what to do if he becomes unwell.",
    // Ordered question sequence; finishing the last question marks this scenario complete.
    "questions": [
      {
        "title": "What should you check before starting your walk?",
        "description": "It feels comfortable outside now, but the day is expected to become much hotter.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "Think about the conditions during the whole walk, not only at the start.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "Only check the current temperature.",
            "feedback": "Not quite. Current conditions do not tell you what conditions will be like during the entire walk."
          },
          {
            "text": "Check the current and upcoming heat and UV conditions.",
            "feedback": "Good choice. Looking ahead helps you avoid being caught outside as conditions become less suitable."
          },
          {
            "text": "Do not check because it is still morning.",
            "feedback": "This may increase your risk. Heat and UV can rise quickly during the morning."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 1
      },
      {
        "title": "When should you start drinking water?",
        "description": "You are preparing to leave for your walk.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "Consider preparing for fluid loss before it affects how you feel.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "Only after you become very thirsty.",
            "feedback": "Not the best choice. Thirst should not be your only reminder to drink during hot weather."
          },
          {
            "text": "Drink regularly and bring water with you.",
            "feedback": "Good choice. Staying hydrated before and during outdoor activity can reduce the risk of dehydration."
          },
          {
            "text": "Avoid drinking so you do not need to stop during the walk.",
            "feedback": "This choice may increase your risk. Avoiding fluids during hot weather can contribute to dehydration."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 1
      },
      {
        "title": "Which walking route would you choose?",
        "description": "Two routes take you to the same destination.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "Compare the exposure and opportunities for breaks along each route.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "A slightly shorter route with shade and places to rest.",
            "feedback": "Good choice. Shade and opportunities to rest can help reduce your heat and UV exposure."
          },
          {
            "text": "An exposed route with no shade because it is more familiar.",
            "feedback": "Not the safer choice today. When heat and UV are elevated, reducing direct exposure is useful."
          },
          {
            "text": "The longest route so you can get more exercise.",
            "feedback": "Not today. Increasing physical activity during hotter conditions can increase heat exposure."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 0
      },
      {
        "title": "What should you do when UV is 3 or above?",
        "description": "The UV Index is currently 5.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "Think about whether one protective measure covers all exposed areas.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "Use a combination of clothing, sunscreen, a hat, shade and sunglasses.",
            "feedback": "Good choice. Using several types of protection together gives better protection from UV."
          },
          {
            "text": "Only use sunscreen.",
            "feedback": "Not quite. Sunscreen is important, but it should not be your only form of protection."
          },
          {
            "text": "No protection is needed because it is still morning.",
            "feedback": "Incorrect. Protection is recommended based on the UV Index, not simply the time of day."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 0
      },
      {
        "title": "What if you become confused or faint?",
        "description": "During the walk, someone becomes very unwell, confused and has difficulty responding normally.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "Consider how serious it is when someone cannot respond normally.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "Continue walking slowly and see whether it passes.",
            "feedback": "This could be dangerous. Confusion can be a sign of serious heat-related illness."
          },
          {
            "text": "Treat it as an emergency and call Triple Zero (000).",
            "feedback": "Correct. Severe symptoms such as confusion, seizures or loss of consciousness require urgent medical help."
          },
          {
            "text": "Wait until you get home before asking for help.",
            "feedback": "Do not delay. Serious heat-related illness can become life-threatening."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 1
      }
    ],
    // Summary text displayed on the scenario completion screen.
    "completionMessage": "Great work! You know how to prepare for a safer walk and recognise when conditions are becoming unsafe.",
    // Main lesson displayed separately to reinforce what the learner should remember.
    "keyTakeaway": "Check how conditions will change, stay hydrated, use shade and sun protection, and never ignore serious heat-related symptoms."
  },
  {
    // Stable scenario ID passed between routes and stored in the shared completion list.
    "id": "gardening",
    "title": "Gardening on a Hot Afternoon",
    image: require("../assets/scenarios/gardening-hot-afternoon.png"),
    "shortDescription": "Decide when and how to garden safely during hot and very high-UV conditions.",
    "tags": [
      "Heat",
      "UV",
      "Gardening",
      "Planning"
    ],
    "estimatedTime": "5 mins",
    "longDescription": "It is 1:30 PM and you want to spend about 45 minutes gardening. The temperature is 34°C and the UV Index is 9 (Very High). SolAdapt shows cooler conditions later in the day.",
    "activity": "You need to decide whether to garden now, how to protect himself if he must briefly go outside, and when to stop if he begins to feel affected by the heat.",
    // Ordered question sequence; finishing the last question marks this scenario complete.
    "questions": [
      {
        "title": "When should you do the gardening?",
        "description": "It is currently hot and UV is very high.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "Think about how physical effort and the time of day affect heat exposure.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "Start now because gardening is done at home.",
            "feedback": "This choice may increase your risk. Being at home does not remove the risk from heat and UV during outdoor activity."
          },
          {
            "text": "Reschedule the gardening for the cooler time shown by SolAdapt.",
            "feedback": "Good choice. Moving strenuous outdoor activity away from hotter periods can reduce heat exposure."
          },
          {
            "text": "Work faster so you can finish sooner.",
            "feedback": "Not recommended. Working harder increases physical exertion and does not remove the heat or UV risk."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 1
      },
      {
        "title": "What if something in the garden cannot wait?",
        "description": "You only need to go outside briefly to water a plant.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "A short outdoor task can still involve heat and sun exposure.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "Use shade where possible, wear light protective clothing and a hat, use sunscreen and take water.",
            "feedback": "Good choice. Even for a shorter activity, reducing heat and UV exposure is sensible when conditions are high."
          },
          {
            "text": "Go outside without protection because it will only take a few minutes.",
            "feedback": "Not the safer choice. Very high UV can cause damage quickly."
          },
          {
            "text": "Wear heavy dark clothing so the sun cannot reach your skin.",
            "feedback": "Not ideal in hot conditions. Protective clothing is useful, but it should also be appropriate for hot weather."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 0
      },
      {
        "title": "Why isn't sunscreen alone enough?",
        "description": "You have already applied sunscreen before going outside.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "Think about the areas that a single protective measure may miss.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "Sunscreen is all the protection you need.",
            "feedback": "Not quite. Sunscreen should be used together with other forms of protection."
          },
          {
            "text": "A combination of protection provides better coverage from UV exposure.",
            "feedback": "Correct. Clothing, sunscreen, a hat, shade and sunglasses work together."
          },
          {
            "text": "Sunscreen is only useful when the UV Index reaches 11.",
            "feedback": "Incorrect. Sun protection is recommended when UV reaches 3 or above."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 1
      },
      {
        "title": "What should you remember if you are sweating?",
        "description": "You have been outdoors and your sunscreen may have been affected by sweating.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "Think about whether protection stays the same while you are active.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "Sunscreen never needs to be reapplied on the same day.",
            "feedback": "Incorrect. Sunscreen protection needs to be maintained while you remain exposed."
          },
          {
            "text": "Reapply sunscreen as recommended, particularly after sweating.",
            "feedback": "Good choice. Reapplying helps maintain protection."
          },
          {
            "text": "Replace sunscreen with water on your skin.",
            "feedback": "Incorrect. Cooling your skin can help with heat, but it does not replace UV protection."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 1
      },
      {
        "title": "What should you do if you start feeling unwell?",
        "description": "While gardening, you develop a headache, dizziness and weakness.",
        // A gentle prompt after three wrong submissions, without naming the correct selection.
        "hint": "Consider what these symptoms mean before deciding to carry on.",
        // Each choice includes its own explanation, shown whether the selected answer is correct or incorrect.
        "options": [
          {
            "text": "Stop, move to a cool place and begin cooling and rehydrating.",
            "feedback": "Good choice. These can be warning signs of heat-related illness and should not be ignored."
          },
          {
            "text": "Finish the gardening first.",
            "feedback": "This may make the situation worse. Stop physical activity when heat-related symptoms develop."
          },
          {
            "text": "Stay outside but sit in the sun.",
            "feedback": "Not recommended. Move to a cooler or shaded environment."
          }
        ],
        // Zero-based position of the correct answer in this question options array.
        "correctOptionIndex": 0
      }
    ],
    // Summary text displayed on the scenario completion screen.
    "completionMessage": "Well done! You made safer choices for gardening in hot and high-UV conditions.",
    // Main lesson displayed separately to reinforce what the learner should remember.
    "keyTakeaway": "Move strenuous outdoor tasks to cooler times, use several forms of sun protection, stay hydrated and stop if you begin to feel unwell."
  }
];
