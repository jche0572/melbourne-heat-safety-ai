// From Quiz contents.pdf; PDF spacing and the degree symbol are normalised.
// Array indexes start at zero: 0 means Option 1.
// Present questions in this order; each record supplies its prompt, choices, and correct answer index.
// Each option carries feedback so every selection can explain the reasoning to the learner.
export const quizQuestions = [
  {
    // Identify this question in the content; the quiz screen advances using its array position.
    "id": 1,
    "title": "What should you check before going outside?",
    "description": "Greg is planning an outdoor activity on a warm day.",
    // Ordered answer choices with individual feedback shown immediately after selection.
    "options": [
      {
        "text": "Only check whether it looks sunny outside.",
        "feedback": "Not quite. Heat and UV cannot always be judged by how the weather looks."
      },
      {
        "text": "Check the heat and UV conditions.",
        "feedback": "Good choice. Checking both heat and UV helps Greg make a more informed outdoor plan."
      },
      {
        "text": "Only check the temperature.",
        "feedback": "Not quite. Temperature does not tell Greg what the UV level is."
      }
    ],
    // Zero-based correct answer position, compared with the selection to award a score point.
    "correctOptionIndex": 1
  },
  {
    // Identify this question in the content; the quiz screen advances using its array position.
    "id": 2,
    "title": "Can UV still be high on a cooler day?",
    "description": "The weather feels cooler than yesterday.",
    // Ordered answer choices with individual feedback shown immediately after selection.
    "options": [
      {
        "text": "No, UV is only high when the temperature is high.",
        "feedback": "Not quite. UV and temperature are different conditions."
      },
      {
        "text": "Yes, UV can still be high even when it feels cool or cloudy.",
        "feedback": "Good choice. UV cannot be reliably judged from temperature or cloud conditions."
      },
      {
        "text": "No, UV only matters during heatwaves.",
        "feedback": "Not quite. UV protection may still be needed outside heatwaves."
      }
    ],
    // Zero-based correct answer position, compared with the selection to award a score point.
    "correctOptionIndex": 1
  },
  {
    // Identify this question in the content; the quiz screen advances using its array position.
    "id": 3,
    "title": "When is sun protection recommended?",
    "description": "Greg checks the UV Index before going outside.",
    // Ordered answer choices with individual feedback shown immediately after selection.
    "options": [
      {
        "text": "When the UV Index is 3 or above.",
        "feedback": "Good choice. Your Scenario Learning content uses UV 3 or above as the point where sun protection is recommended."
      },
      {
        "text": "Only when the UV Index reaches 11.",
        "feedback": "Not quite. Protection is recommended before UV reaches that level."
      },
      {
        "text": "Only when the temperature is above 30°C.",
        "feedback": "Not quite. UV protection is based on UV conditions, not temperature alone."
      }
    ],
    // Zero-based correct answer position, compared with the selection to award a score point.
    "correctOptionIndex": 0
  },
  {
    // Identify this question in the content; the quiz screen advances using its array position.
    "id": 4,
    "title": "What should Greg do about water on a hot day?",
    "description": "Greg is preparing for an outdoor walk.",
    // Ordered answer choices with individual feedback shown immediately after selection.
    "options": [
      {
        "text": "Wait until he becomes very thirsty before drinking.",
        "feedback": "Not the best choice. Thirst should not be the only reminder to drink during hot weather."
      },
      {
        "text": "Drink regularly and bring water with him.",
        "feedback": "Good choice. Staying hydrated before and during outdoor activity can reduce the risk of dehydration."
      },
      {
        "text": "Avoid drinking so he does not need to stop.",
        "feedback": "Not recommended. Avoiding fluids during hot weather can contribute to dehydration."
      }
    ],
    // Zero-based correct answer position, compared with the selection to award a score point.
    "correctOptionIndex": 1
  },
  {
    // Identify this question in the content; the quiz screen advances using its array position.
    "id": 5,
    "title": "Which choice provides better UV protection?",
    "description": "Greg needs to go outside when the UV level is high.",
    // Ordered answer choices with individual feedback shown immediately after selection.
    "options": [
      {
        "text": "Sunglasses only.",
        "feedback": "Not enough. Sunglasses help protect the eyes, but other forms of protection are also recommended."
      },
      {
        "text": "Sunscreen only.",
        "feedback": "Not quite. Sunscreen should be used together with other forms of protection."
      },
      {
        "text": "Clothing, sunscreen, a broad-brimmed hat, shade and sunglasses.",
        "feedback": "Good choice. Using several forms of sun protection together provides better coverage."
      }
    ],
    // Zero-based correct answer position, compared with the selection to award a score point.
    "correctOptionIndex": 2
  },
  {
    // Identify this question in the content; the quiz screen advances using its array position.
    "id": 6,
    "title": "Which walking route should Greg choose?",
    "description": "Two routes lead to the same destination on a hot and sunny day.",
    // Ordered answer choices with individual feedback shown immediately after selection.
    "options": [
      {
        "text": "A route with shade and places to rest.",
        "feedback": "Good choice. Shade and opportunities to rest can help reduce heat and UV exposure."
      },
      {
        "text": "An exposed route with no shade.",
        "feedback": "Not the better choice when heat and UV are elevated."
      },
      {
        "text": "The longest route so Greg can spend more time outside.",
        "feedback": "Not recommended during hotter conditions because it increases outdoor exposure."
      }
    ],
    // Zero-based correct answer position, compared with the selection to award a score point.
    "correctOptionIndex": 0
  },
  {
    // Identify this question in the content; the quiz screen advances using its array position.
    "id": 7,
    "title": "When should Greg do an outdoor activity?",
    "description": "SolAdapt shows that conditions will be cooler later in the day.",
    // Ordered answer choices with individual feedback shown immediately after selection.
    "options": [
      {
        "text": "Go immediately because the activity is already planned.",
        "feedback": "Not necessarily. Planned outdoor activities can be adjusted when conditions are less suitable."
      },
      {
        "text": "Choose the cooler time shown by SolAdapt.",
        "feedback": "Good choice. Moving outdoor activity away from hotter periods can reduce heat exposure."
      },
      {
        "text": "Wait exactly one hour without checking again.",
        "feedback": "Not quite. Conditions do not always improve after a fixed amount of time."
      }
    ],
    // Zero-based correct answer position, compared with the selection to award a score point.
    "correctOptionIndex": 1
  },
  {
    // Identify this question in the content; the quiz screen advances using its array position.
    "id": 8,
    "title": "Where should Greg rest on a hot day?",
    "description": "Greg wants to take a break from hot outdoor conditions.",
    // Ordered answer choices with individual feedback shown immediately after selection.
    "options": [
      {
        "text": "In direct sunlight.",
        "feedback": "Not recommended. Remaining exposed to heat does not provide a cooling break."
      },
      {
        "text": "In a cool or shaded place.",
        "feedback": "Good choice. Moving somewhere cooler or shaded reduces direct heat exposure."
      },
      {
        "text": "On an exposed paved area.",
        "feedback": "Not the better choice because it provides little protection from direct sun."
      }
    ],
    // Zero-based correct answer position, compared with the selection to award a score point.
    "correctOptionIndex": 1
  },
  {
    // Identify this question in the content; the quiz screen advances using its array position.
    "id": 9,
    "title": "What should Greg do if he feels lightheaded and unusually tired?",
    "description": "Greg begins to feel unwell while walking outdoors.",
    // Ordered answer choices with individual feedback shown immediately after selection.
    "options": [
      {
        "text": "Keep walking until he reaches his destination.",
        "feedback": "This may increase the risk. Continuing physical activity can worsen heat-related symptoms."
      },
      {
        "text": "Stop, move to a cool or shaded place, rest and drink water.",
        "feedback": "Good choice. The Scenario Learning guidance says to stop the activity, cool down and rehydrate."
      },
      {
        "text": "Sit in direct sunlight until he feels better.",
        "feedback": "Not recommended. Greg should move somewhere cooler or shaded."
      }
    ],
    // Zero-based correct answer position, compared with the selection to award a score point.
    "correctOptionIndex": 1
  },
  {
    // Identify this question in the content; the quiz screen advances using its array position.
    "id": 10,
    "title": "What should happen if someone becomes confused or faints?",
    "description": "During a hot-weather activity, someone becomes very unwell and has difficulty responding normally.",
    // Ordered answer choices with individual feedback shown immediately after selection.
    "options": [
      {
        "text": "Continue slowly and see whether it passes.",
        "feedback": "This could be dangerous. Confusion can be a sign of serious heat-related illness."
      },
      {
        "text": "Treat it as an emergency and call Triple Zero (000).",
        "feedback": "Good choice. Your Scenario Learning content identifies confusion, seizures and loss of consciousness as symptoms requiring urgent medical help."
      },
      {
        "text": "Wait until getting home before asking for help.",
        "feedback": "Do not delay when serious symptoms are present."
      }
    ],
    // Zero-based correct answer position, compared with the selection to award a score point.
    "correctOptionIndex": 1
  }
];
