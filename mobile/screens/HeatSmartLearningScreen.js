import { useThemedStyles } from "../theme/useAppTheme";

import React from "react";

import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  scenarios,
} from "../data/scenarios";

import {
  visualActivities,
} from "../data/visualLearning";

import {
  getLearningAccess,
  QUIZ_UNLOCK_MESSAGE,
  SCENARIO_UNLOCK_MESSAGE,
} from "../utils/learningProgress";


/* =========================================================
   LEARNING MODULE DEFINITIONS
========================================================= */

const MODULES = [
  {
    title: "Visual Learning",
    icon: "book-outline",
    color: "#4BB34A",
    tint: "#FFF1D8",
    iconColor: "#FF9F19",
  },

  {
    title: "Scenario Learning",
    icon: "walk-outline",
    color: "#4D83FF",
    tint: "#EFE8FC",
    iconColor: "#9565F5",
  },

  {
    title: "Quizzes",
    icon: "reader-outline",
    color: "#FFA51B",
    tint: "#FCE4E5",
    iconColor: "#FF535C",
  },
];


/* =========================================================
   KNOWLEDGE AREA DEFINITIONS
========================================================= */

const KNOWLEDGE = [
  {
    title: "Heat Safety",
    icon: "sunny-outline",

    visualActivityIds: [
      2,
      3,
      4,
      6,
      7,
      8,
      9,
    ],

    color: "#FF6570",
    tint: "#FFE3CD",
    iconColor: "#FF8B25",
  },

  {
    title: "UV Safety",
    icon: "shield-outline",

    visualActivityIds: [
      1,
      2,
      4,
      5,
      6,
      7,
      9,
    ],

    color: "#4D83FF",
    tint: "#DDEAFF",
    iconColor: "#4D83FF",
  },

  {
    title: "Safe Planning",
    icon: "location-outline",

    visualActivityIds: [
      4,
      6,
      7,
      8,
      9,
    ],

    color: "#4BB34A",
    tint: "#DCF0DC",
    iconColor: "#4BB34A",
  },
];


/*
 * These scenarios contribute to each knowledge area.
 */
const KNOWLEDGE_SCENARIO_IDS = [
  "market",
  "morning-walk",
  "gardening",
];


/* =========================================================
   PROGRESS BAR

   Uses the current application theme so the progress bars
   remain readable in both light and dark mode.
========================================================= */

function ProgressBar({
  value,
  color,
  label,
  trackColor = "#ECEEF1",
}) {
  const {
    styles,
    theme,
  } = useThemedStyles(baseStyles);

  return (
    <View
      accessibilityRole="progressbar"

      accessibilityLabel={
        label
      }

      accessibilityValue={{
        min: 0,
        max: 100,
        now: value,
      }}

      style={[
        styles.track,

        {
          backgroundColor:
            theme.color(
              trackColor,
              "backgroundColor"
            ),
        },
      ]}
    >
      <View
        style={[
          styles.fill,

          {
            width:
              `${value}%`,

            backgroundColor:
              theme.color(
                color,
                "backgroundColor"
              ),
          },
        ]}
      />
    </View>
  );
}


/* =========================================================
   MODULE / KNOWLEDGE ICON
========================================================= */

function IconTile({
  item,
}) {
  const {
    styles,
    theme,
  } = useThemedStyles(baseStyles);

  return (
    <View
      style={[
        styles.iconTile,

        {
          backgroundColor:
            theme.color(
              item.tint,
              "backgroundColor"
            ),
        },
      ]}
    >
      <Ionicons
        name={
          item.icon
        }

        size={21}

        color={
          theme.color(
            item.iconColor
          )
        }
      />
    </View>
  );
}


/* =========================================================
   HEAT SMART LEARNING SCREEN
========================================================= */

export default function HeatSmartLearningScreen({
  navigation,
  route,

  completedScenarioIds = [],
  quizCompleted = false,
  completedVisualActivityIds = [],
}) {
  const {
    styles,
    theme,
  } = useThemedStyles(baseStyles);


  /* ---------------------------------------------------------
     LEARNING ACCESS / UNLOCK RULES

     The same function is also used by App.js route guards.

     This means the dashboard and the navigation guards use
     the same rules for deciding whether Scenario Learning
     and the Quiz are available.
  --------------------------------------------------------- */

  const learningAccess =
    getLearningAccess(
      completedVisualActivityIds,
      completedScenarioIds
    );


  /*
   * If a user tries to directly open a locked route,
   * LearningRouteGuard can return them here and indicate
   * which module was blocked.
   */
  const lockedModule =
    route?.params?.lockedModule;

  const accessNotice =
    lockedModule === "scenario" &&
    !learningAccess.scenarioUnlocked
      ? SCENARIO_UNLOCK_MESSAGE

      : lockedModule === "quiz" &&
        !learningAccess.quizUnlocked
        ? QUIZ_UNLOCK_MESSAGE

        : null;


  /* ---------------------------------------------------------
     KNOWLEDGE PROGRESS
  --------------------------------------------------------- */

  const completedKnowledgeScenarios =
    KNOWLEDGE_SCENARIO_IDS.filter(
      (id) =>
        completedScenarioIds.includes(
          id
        )
    ).length;


  const knowledge =
    KNOWLEDGE.map(
      (item) => {
        const completed =
          item.visualActivityIds.filter(
            (id) =>
              completedVisualActivityIds.includes(
                id
              )
          ).length
          +
          completedKnowledgeScenarios
          +
          (
            quizCompleted
              ? 1
              : 0
          );

        const total =
          item.visualActivityIds.length
          +
          KNOWLEDGE_SCENARIO_IDS.length
          +
          1;

        return {
          ...item,

          progress:
            Math.round(
              (
                completed /
                total
              ) *
              100
            ),
        };
      }
    );


  /* ---------------------------------------------------------
     MODULE PROGRESS

     Visual Learning:
       Always available.

     Scenario Learning:
       Unlocks according to getLearningAccess().

     Quiz:
       Unlocks according to getLearningAccess().
  --------------------------------------------------------- */

  const modules =
    MODULES.map(
      (item) => {

        /* Visual Learning */

        if (
          item.title ===
          "Visual Learning"
        ) {
          return {
            ...item,

            completed:
              visualActivities.filter(
                (activity) =>
                  completedVisualActivityIds.includes(
                    activity.id
                  )
              ).length,

            total:
              visualActivities.length,

            locked:
              false,
          };
        }


        /* Scenario Learning */

        if (
          item.title ===
          "Scenario Learning"
        ) {
          return {
            ...item,

            completed:
              learningAccess
                .completedScenarioCount,

            total:
              scenarios.length,

            locked:
              !learningAccess
                .scenarioUnlocked,

            unlockMessage:
              SCENARIO_UNLOCK_MESSAGE,
          };
        }


        /* Quiz */

        if (
          item.title ===
          "Quizzes"
        ) {
          return {
            ...item,

            completed:
              quizCompleted
                ? 1
                : 0,

            total: 1,

            locked:
              !learningAccess
                .quizUnlocked,

            unlockMessage:
              QUIZ_UNLOCK_MESSAGE,
          };
        }


        return item;
      }
    );


  /* ---------------------------------------------------------
     CURRENT LEARNING LEVEL

     Find the first available module that has not yet been
     completed.

     This lets the UI show the learner where to continue.
  --------------------------------------------------------- */

  const currentLevel =
    modules.findIndex(
      (item) =>
        !item.locked &&
        item.completed <
          item.total
    );


  /* ---------------------------------------------------------
     OVERALL PROGRESS
  --------------------------------------------------------- */

  const completedCount =
    modules.reduce(
      (
        total,
        item
      ) =>
        total +
        item.completed,

      0
    );

  const totalActivities =
    modules.reduce(
      (
        total,
        item
      ) =>
        total +
        item.total,

      0
    );


  const progressPercentage =
    totalActivities > 0
      ? Math.round(
          (
            completedCount /
            totalActivities
          ) *
          100
        )
      : 0;


  const progressTitle =
    progressPercentage === 0
      ? "Let's get started!"

      : progressPercentage === 100
        ? "Well done!"

        : "Great job!";


  const progressMessage =
    progressPercentage === 0
      ? "Start an activity to build your heat safety skills."

      : progressPercentage === 100
        ? "You've completed all learning activities."

        : "You're learning how to travel more safely.";


  /* =========================================================
     UI
  ========================================================= */

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <StatusBar
        barStyle={
          theme.dark
            ? "light-content"
            : "dark-content"
        }
      />

      {/*
        This screen is now the root of the Learn bottom tab,
        so the old back button is intentionally not included.
      */}
      <ScrollView
        style={
          styles.screen
        }

        contentContainerStyle={
          styles.page
        }

        showsVerticalScrollIndicator={
          false
        }
      >

        {/* ================= HEADER ================= */}

        <View
          style={[
            styles.topHeader,
            {
              backgroundColor: theme.dark
                ? "#283B35"
                : "#F5F8F6",
            },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={[
              styles.topHeaderTitle,
              {
                color: theme.dark
                  ? "#F2F4F3"
                  : "#173C31",
              },
            ]}
          >
            Heat Smart Learning
          </Text>

          <View
            style={[
              styles.headerIconButton,
              {
                backgroundColor: theme.dark
                  ? "#263A34"
                  : "#EAF4EF",

                borderColor: theme.dark
                  ? "#476158"
                  : "#AFC9BD",
              },
            ]}
          >
            <Ionicons
              name="book-outline"
              size={22}
              color={
                theme.dark
                  ? "#D9E7E1"
                  : "#173C31"
              }
            />
          </View>
        </View>

        <Text
          style={[
            styles.subtitle,
            {
              color: theme.dark
                ? "#B8C8C1"
                : "#5A6862",
            },
          ]}
        >
          Track your heat and UV safety learning
        </Text>

        {/* ================= LOCK NOTICE ================= */}

        {accessNotice && (
          <Text
            accessibilityRole="alert"

            style={
              styles.placeholderMessage
            }
          >
            {
              accessNotice
            }
          </Text>
        )}


        {/* ================= OVERALL PROGRESS ================= */}

        <View
          style={[
            styles.card,
            styles.progressCard,
          ]}
        >
          <View
            style={
              styles.progressRow
            }
          >
            <View
              style={
                styles.progressSummary
              }
            >
              <Text
                style={
                  styles.progressLabel
                }
              >
                Your Progress
              </Text>

              <Text
                style={
                  styles.percentage
                }
              >
                {
                  progressPercentage
                }%
              </Text>

              <Text
                style={
                  styles.caption
                }
              >
                {
                  completedCount
                }{" "}
                of{" "}
                {
                  totalActivities
                }{" "}
                activities completed
              </Text>
            </View>


            <View
              style={
                styles.encouragementColumn
              }
            >
              <Ionicons
                name="leaf-outline"

                size={23}

                color={
                  theme.color(
                    "#28A65C"
                  )
                }

                style={
                  styles.leaf
                }
              />

              <View
                style={
                  styles.encouragement
                }
              >
                <Text
                  style={
                    styles.encouragementTitle
                  }
                >
                  {
                    progressTitle
                  }
                </Text>

                <Text
                  style={
                    styles.encouragementText
                  }
                >
                  {
                    progressMessage
                  }
                </Text>
              </View>
            </View>
          </View>


          <ProgressBar
            value={
              progressPercentage
            }

            color="#4D83FF"

            trackColor="#D1E3FB"

            label="Overall learning progress"
          />
        </View>


        {/* ================= LEARNING JOURNEY ================= */}

        <View
          style={
            styles.journey
          }
        >
          <Text
            accessibilityRole="header"

            style={
              styles.sectionTitle
            }
          >
            Your learning journey
          </Text>

          <Text
            style={
              styles.journeyCaption
            }
          >
            Follow the path: learn, practise, then take the final challenge.
          </Text>


          {modules.map(
            (
              item,
              index
            ) => {
              const complete =
                item.total > 0 &&
                item.completed ===
                  item.total;

              const current =
                index ===
                currentLevel;

              const nextUnlocked =
                index <
                  modules.length -
                    1 &&
                !modules[
                  index + 1
                ].locked;


              const status =
                item.locked
                  ? "Locked"

                  : complete
                    ? "Completed"

                    : current
                      ? "Your next level"

                      : "Available";


              const nextMessage =
                index === 0
                  ? nextUnlocked
                    ? "Level 2 unlocked — practise what you've learned."

                    : `Complete all ${item.total} activities to unlock Level 2.`

                  : index === 1
                    ? nextUnlocked
                      ? "Level 3 unlocked — you're ready for the final challenge."

                      : `Complete Visual Learning and all ${item.total} scenarios to unlock Level 3.`

                    : "Put your heat and UV safety skills to the test.";


              return (
                <View
                  key={
                    item.title
                  }
                >

                  {/* MODULE CARD */}

                  <TouchableOpacity
                    testID={
                      `learning-level-${index + 1}`
                    }

                    activeOpacity={
                      0.7
                    }

                    disabled={
                      !!item.locked
                    }

                    accessibilityRole="button"

                    accessibilityState={{
                      disabled:
                        !!item.locked,
                    }}

                    accessibilityLabel={
                      `${item.title}, Level ${index + 1}${
                        index === 2
                          ? ", Final challenge"
                          : ""
                      }, ${status}, ${item.completed} of ${item.total} completed`
                    }

                    accessibilityHint={
                      item.locked
                        ? item.unlockMessage
                        : "Opens the learning module"
                    }

                    style={[
                      styles.moduleRow,

                      complete &&
                        styles.completedModule,

                      current &&
                        styles.currentModule,

                      item.locked &&
                        styles.lockedModule,
                    ]}

                    onPress={() => {
                      /*
                       * Keep a second check here even though
                       * the TouchableOpacity is disabled.
                       */
                      if (
                        item.locked
                      ) {
                        return;
                      }

                      if (
                        item.title ===
                        "Scenario Learning"
                      ) {
                        navigation.navigate(
                          "ScenarioLearning"
                        );
                      }
                      else if (
                        item.title ===
                        "Quizzes"
                      ) {
                        navigation.navigate(
                          "Quiz"
                        );
                      }
                      else {
                        navigation.navigate(
                          "VisualLearning"
                        );
                      }
                    }}
                  >

                    {/* ICON */}

                    <IconTile
                      item={{
                        ...item,

                        tint:
                          item.locked
                            ? "#E4E8E6"
                            : "#E2F0E8",

                        iconColor:
                          item.locked
                            ? "#7A8580"
                            : "#39775F",
                      }}
                    />


                    {/* MODULE DETAILS */}

                    <View
                      style={
                        styles.moduleContent
                      }
                    >
                      <View
                        style={
                          styles.levelHeading
                        }
                      >
                        <Text
                          style={[
                            styles.levelLabel,

                            item.locked &&
                              styles.lockedText,
                          ]}
                        >
                          Level {
                            index + 1
                          }
                        </Text>

                        {index ===
                          2 && (
                          <Ionicons
                            name="trophy-outline"

                            size={15}

                            color={
                              theme.color(
                                item.locked
                                  ? "#7A8580"
                                  : "#9A7529"
                              )
                            }
                          />
                        )}
                      </View>


                      <Text
                        style={
                          styles.rowTitle
                        }
                      >
                        {
                          item.title
                        }
                      </Text>


                      <Text
                        style={[
                          styles.levelStatus,

                          item.locked &&
                            styles.lockedText,
                        ]}
                      >
                        {index === 2
                          ? `Final challenge · ${status}`
                          : status}
                      </Text>


                      {item.locked && (
                        <Text
                          style={
                            styles.moduleCaption
                          }
                        >
                          {
                            item.unlockMessage
                          }
                        </Text>
                      )}


                      <Text
                        style={
                          styles.moduleCaption
                        }
                      >
                        {
                          item.completed
                        }{" "}
                        /{" "}
                        {
                          item.total
                        }{" "}
                        completed
                      </Text>


                      <ProgressBar
                        value={
                          Math.round(
                            (
                              item.completed /
                              item.total
                            ) *
                            100
                          )
                        }

                        color={
                          item.locked
                            ? "#A2ADA7"
                            : "#39775F"
                        }

                        label={
                          `${item.title} progress`
                        }
                      />


                      {!item.locked && (
                        <Text
                          style={
                            styles.nextMessage
                          }
                        >
                          {
                            nextMessage
                          }
                        </Text>
                      )}
                    </View>


                    {/* STATUS ICON */}

                    <View
                      style={
                        styles.moduleAccessory
                      }
                    >
                      {complete && (
                        <Ionicons
                          name="checkmark-circle"

                          size={23}

                          color={
                            theme.color(
                              "#39775F"
                            )
                          }
                        />
                      )}

                      <Ionicons
                        name={
                          item.locked
                            ? "lock-closed-outline"
                            : "chevron-forward"
                        }

                        size={18}

                        color={
                          theme.color(
                            "#9CA4AF"
                          )
                        }
                      />
                    </View>
                  </TouchableOpacity>


                  {/* JOURNEY CONNECTOR */}

                  {index <
                    modules.length -
                      1 && (
                    <View
                      testID={
                        `learning-connector-${index + 1}`
                      }

                      accessible={
                        false
                      }

                      accessibilityElementsHidden

                      importantForAccessibility="no-hide-descendants"

                      style={
                        styles.connector
                      }
                    >
                      <View
                        style={[
                          styles.dashedLine,

                          complete &&
                            nextUnlocked &&
                            styles.completedLine,
                        ]}
                      />

                      <Ionicons
                        name="arrow-down"

                        size={16}

                        color={
                          theme.color(
                            complete &&
                              nextUnlocked
                              ? "#39775F"
                              : "#B4BDB8"
                          )
                        }
                      />
                    </View>
                  )}
                </View>
              );
            }
          )}
        </View>


        {/* ================= KNOWLEDGE PROGRESS ================= */}

        <View
          style={[
            styles.card,
            styles.knowledgeCard,
          ]}
        >
          <Text
            accessibilityRole="header"

            style={
              styles.sectionTitle
            }
          >
            Knowledge Progress
          </Text>


          {knowledge.map(
            (item) => (
              <View
                key={
                  item.title
                }

                style={
                  styles.knowledgeRow
                }
              >
                <IconTile
                  item={
                    item
                  }
                />

                <Text
                  style={[
                    styles.rowTitle,
                    styles.knowledgeTitle,
                  ]}
                >
                  {
                    item.title
                  }
                </Text>

                <View
                  style={
                    styles.knowledgeBar
                  }
                >
                  <ProgressBar
                    value={
                      item.progress
                    }

                    color={
                      item.color
                    }

                    trackColor="#E9E2D3"

                    label={
                      `${item.title} knowledge`
                    }
                  />
                </View>

                <Text
                  style={
                    styles.knowledgePercentage
                  }
                >
                  {
                    item.progress
                  }%
                </Text>
              </View>
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


/* =========================================================
   THEMED STYLES
========================================================= */

const baseStyles =
  StyleSheet.create({

    safeArea: {
      flex: 1,
      backgroundColor:
        "#EEF2F0",
    },


    /*
     * Bottom padding leaves enough space for the new
     * LiquidGlassTabBar.
     */
    screen: {
      flex: 1,
      minHeight: 0,

      width: "100%",

      maxWidth: 430,

      alignSelf:
        "center",

      backgroundColor:
        "#F5F8F6",
    },


    page: {
      width: "100%",

      maxWidth: 430,

      alignSelf:
        "center",

      paddingHorizontal:
        16,

      paddingTop: 14,

      paddingBottom:
        112,

      gap: 16,
    },


    header: {
      flexDirection:
        "row",

      alignItems:
        "center",

      marginBottom: 2,
    },


    heading: {
      flex: 1,
    },


    title: {
      fontSize: 21,

      lineHeight: 27,

      fontWeight:
        "800",

      color:
        "#182131",
    },


    subtitle: {
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 16,
    },


    card: {
      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        "#E9ECF0",

      borderRadius: 16,

      padding: 16,
    },


    progressCard: {
      backgroundColor:
        "#EBF3FF",

      borderColor:
        "#D1E3FF",
    },


    progressRow: {
      flexDirection:
        "row",

      gap: 10,

      marginBottom:
        14,
    },


    progressSummary: {
      flex: 1,
    },


    progressLabel: {
      fontSize: 12,

      color:
        "#50617B",

      marginBottom: 4,
    },


    percentage: {
      fontSize: 36,

      fontWeight:
        "700",

      color:
        "#182131",
    },


    caption: {
      fontSize: 11,

      lineHeight: 16,

      color:
        "#70798A",

      marginTop: 5,
    },


    encouragementColumn: {
      width: "40%",

      maxWidth: 128,

      gap: 10,
    },


    leaf: {
      alignSelf:
        "flex-end",

      marginRight: 5,
    },


    encouragement: {
      backgroundColor:
        "#DDEEFF",

      borderColor:
        "#BFDEFF",

      borderWidth: 1,

      borderRadius: 12,

      padding: 10,
    },


    encouragementTitle: {
      fontSize: 11,

      fontWeight:
        "700",

      color:
        "#182131",

      marginBottom: 4,
    },


    encouragementText: {
      fontSize: 10,

      lineHeight: 14,

      color:
        "#657386",
    },


    track: {
      height: 6,

      borderRadius: 4,

      overflow:
        "hidden",
    },


    fill: {
      height: "100%",

      borderRadius: 4,
    },


    sectionTitle: {
      fontSize: 16,

      fontWeight:
        "700",

      color:
        "#182131",

      marginBottom: 8,
    },


    /* Learning journey */

    journey: {
      gap: 0,
    },


    journeyCaption: {
      fontSize: 12,

      lineHeight: 18,

      color:
        "#65736B",

      marginBottom: 14,
    },


    moduleRow: {
      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 10,

      padding: 14,

      minHeight: 68,

      borderWidth: 1,

      borderColor:
        "#DCE5DF",

      borderRadius: 16,

      backgroundColor:
        "#FFFFFF",
    },


    currentModule: {
      borderColor:
        "#39775F",

      borderWidth: 2,

      backgroundColor:
        "#EFF8F2",
    },


    completedModule: {
      borderColor:
        "#93BBA4",

      backgroundColor:
        "#F8FCF9",
    },


    lockedModule: {
      backgroundColor:
        "#F1F3F2",

      borderColor:
        "#DDE2DF",
    },


    levelHeading: {
      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 6,

      marginBottom: 4,
    },


    levelLabel: {
      fontSize: 11,

      fontWeight:
        "700",

      color:
        "#39775F",

      letterSpacing:
        0.5,
    },


    levelStatus: {
      fontSize: 11,

      fontWeight:
        "600",

      color:
        "#39775F",

      marginTop: 4,
    },


    lockedText: {
      color:
        "#737E78",
    },


    nextMessage: {
      fontSize: 11,

      lineHeight: 16,

      color:
        "#53695C",

      marginTop: 8,
    },


    connector: {
      width: 38,

      alignItems:
        "center",

      alignSelf:
        "flex-end",

      marginRight: 14,

      paddingVertical: 4,
    },


    dashedLine: {
      height: 20,

      borderLeftWidth: 2,

      borderStyle:
        "dashed",

      borderColor:
        "#B4BDB8",
    },


    completedLine: {
      borderColor:
        "#39775F",
    },


    iconTile: {
      width: 38,

      height: 38,

      borderRadius: 12,

      alignItems:
        "center",

      justifyContent:
        "center",
    },


    moduleContent: {
      flex: 1,

      minWidth: 0,
    },


    rowTitle: {
      fontSize: 13,

      fontWeight:
        "600",

      color:
        "#253147",
    },


    moduleCaption: {
      fontSize: 11,

      color:
        "#7E8796",

      marginTop: 5,

      marginBottom: 7,
    },


    moduleAccessory: {
      width: 24,

      gap: 6,

      alignItems:
        "center",

      justifyContent:
        "center",
    },


    placeholderMessage: {
      fontSize: 12,

      lineHeight: 18,

      color:
        "#39775F",

      backgroundColor:
        "#EEF6F2",

      borderRadius: 8,

      padding: 10,

      marginTop: 8,
    },


    knowledgeCard: {
      backgroundColor:
        "#FBF6EC",

      borderColor:
        "#F1E6D5",
    },


    knowledgeRow: {
      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 10,

      paddingTop: 12,
    },


    knowledgeTitle: {
      flex: 1.1,

      minWidth: 0,
    },


    knowledgeBar: {
      flex: 1,

      minWidth: 24,
    },


    knowledgePercentage: {
      width: 34,

      fontSize: 12,

      fontWeight:
        "600",

      color:
        "#43506A",

      textAlign:
        "right",
    },


    topHeader: {
      minHeight: 72,

      marginHorizontal: -16,
      marginTop: -14,
      marginBottom: 14,

      paddingHorizontal: 18,

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    topHeaderTitle: {
      flex: 1,

      fontSize: 22,
      lineHeight: 28,
      fontWeight: "700",
    },

    headerIconButton: {
      width: 44,
      height: 44,

      borderRadius: 14,

      alignItems: "center",
      justifyContent: "center",

      borderWidth: 1,
    },
  });
