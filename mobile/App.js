import React, {
  useRef,
  useState,
} from "react";

import {
  View,
} from "react-native";

import {
  StatusBar,
} from "expo-status-bar";

import {
  SafeAreaProvider,
} from "react-native-safe-area-context";

import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  StackActions,
} from "@react-navigation/native";

import {
  createNativeStackNavigator,
} from "@react-navigation/native-stack";

import {
  createBottomTabNavigator,
} from "@react-navigation/bottom-tabs";

import {
  AppThemeProvider,
  useAppTheme,
} from "./theme/useAppTheme";

/* =========================================================
   SCREENS
========================================================= */

import HomeScreen from "./screens/HomeScreen";
import HeatSmartLearningScreen from "./screens/HeatSmartLearningScreen";
import QuizScreen from "./screens/QuizScreen";
import VisualLearningScreen from "./screens/VisualLearningScreen";

import {
  ScenarioLearningScreen,
  ScenarioDetailsScreen,
  ScenarioQuestionScreen,
  ScenarioCompleteScreen,
} from "./screens/ScenarioLearningScreen";

import NearbyCoolingScreen from "./screens/NearbyCoolingScreen";
import CoolingNavigationScreen from "./screens/CoolingNavigationScreen";

import HeatAwareActivityPlannerScreen from "./screens/HeatAwareActivityPlannerScreen";
import EventDetailsScreen from "./screens/EventDetailsScreen";
import EventPlannerScreen from "./screens/EventPlannerScreen";

import FeedbackFormListScreen from "./screens/FeedbackFormListScreen";
import FeedbackFormScreen from "./screens/FeedbackFormScreen";

/* =========================================================
   LEARNING
========================================================= */

import LearningRouteGuard from "./components/LearningRouteGuard";

import {
  getLearningAccess,
} from "./utils/learningProgress";

/* =========================================================
   UI
========================================================= */

import LiquidGlassTabBar from "./components/LiquidGlassTabBar";

/* =========================================================
   MINI MAP / GOOGLE MAPS
========================================================= */

import MiniMapOverlay from "./components/MiniMapOverlay";
import MiniMapProvider from "./components/MiniMapProvider";

import {
  restoreCoolingRoute,
} from "./utils/miniMapRoute";

import {
  createGoogleMapsLauncher,
} from "./utils/googleMapsNavigation";


/* =========================================================
   NAVIGATORS
========================================================= */

const RootStack =
  createNativeStackNavigator();

const PlannerStack =
  createNativeStackNavigator();

const LearningStack =
  createNativeStackNavigator();

const Tab =
  createBottomTabNavigator();


/* =========================================================
   PLANNER STACK

   The Planner tab has its own navigation stack so Event
   Details and Event Planner remain inside the Planner tab.
========================================================= */

function PlannerStackNavigator() {
  return (
    <PlannerStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <PlannerStack.Screen
        name="PlannerTimeline"
        component={
          HeatAwareActivityPlannerScreen
        }
      />

      <PlannerStack.Screen
        name="EventDetails"
        component={
          EventDetailsScreen
        }
      />

      <PlannerStack.Screen
        name="EventPlanner"
        component={
          EventPlannerScreen
        }
      />
    </PlannerStack.Navigator>
  );
}


/* =========================================================
   LEARNING STACK

   Keeps all Heat Smart Learning pages inside the Learn tab.

   LearningRouteGuard is preserved from the original version
   so users cannot manually navigate to locked Quiz or
   Scenario routes before completing the required content.
========================================================= */

function LearningStackNavigator({
  completedScenarioIds,
  quizCompleted,
  completedVisualActivityIds,
  completeScenario,
  completeVisualActivity,
  completeQuiz,
  learningAccess,
}) {
  return (
    <LearningStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <LearningStack.Screen
        name="LearningHome"
      >
        {(props) => (
          <HeatSmartLearningScreen
            {...props}
            completedScenarioIds={
              completedScenarioIds
            }
            quizCompleted={
              quizCompleted
            }
            completedVisualActivityIds={
              completedVisualActivityIds
            }
          />
        )}
      </LearningStack.Screen>

      <LearningStack.Screen
        name="VisualLearning"
      >
        {(props) => (
          <VisualLearningScreen
            {...props}
            completedActivities={
              completedVisualActivityIds
            }
            onActivityComplete={
              completeVisualActivity
            }
          />
        )}
      </LearningStack.Screen>

      {/* Quiz stays locked until its learning requirement is met. */}
      <LearningStack.Screen
        name="Quiz"
      >
        {(props) => (
          <LearningRouteGuard
            allowed={
              learningAccess.quizUnlocked
            }
            navigation={
              props.navigation
            }
            module="quiz"
          >
            <QuizScreen
              {...props}
              onComplete={
                completeQuiz
              }
            />
          </LearningRouteGuard>
        )}
      </LearningStack.Screen>

      {/* Scenario Learning stays locked until its requirement is met. */}
      <LearningStack.Screen
        name="ScenarioLearning"
      >
        {(props) => (
          <LearningRouteGuard
            allowed={
              learningAccess.scenarioUnlocked
            }
            navigation={
              props.navigation
            }
            module="scenario"
          >
            <ScenarioLearningScreen
              {...props}
              completedScenarioIds={
                completedScenarioIds
              }
            />
          </LearningRouteGuard>
        )}
      </LearningStack.Screen>

      <LearningStack.Screen
        name="ScenarioDetails"
      >
        {(props) => (
          <LearningRouteGuard
            allowed={
              learningAccess.scenarioUnlocked
            }
            navigation={
              props.navigation
            }
            module="scenario"
          >
            <ScenarioDetailsScreen
              {...props}
            />
          </LearningRouteGuard>
        )}
      </LearningStack.Screen>

      <LearningStack.Screen
        name="ScenarioQuestion"
      >
        {(props) => (
          <LearningRouteGuard
            allowed={
              learningAccess.scenarioUnlocked
            }
            navigation={
              props.navigation
            }
            module="scenario"
          >
            {/*
              Remount when a different scenario is opened
              so previous question/feedback state is cleared.
            */}
            <ScenarioQuestionScreen
              key={
                props.route?.params
                  ?.scenarioId
              }
              {...props}
              onComplete={
                completeScenario
              }
            />
          </LearningRouteGuard>
        )}
      </LearningStack.Screen>

      <LearningStack.Screen
        name="ScenarioComplete"
      >
        {(props) => (
          <LearningRouteGuard
            allowed={
              learningAccess.scenarioUnlocked
            }
            navigation={
              props.navigation
            }
            module="scenario"
          >
            <ScenarioCompleteScreen
              {...props}
            />
          </LearningRouteGuard>
        )}
      </LearningStack.Screen>
    </LearningStack.Navigator>
  );
}


/* =========================================================
   MAIN BOTTOM TABS
========================================================= */

function MainTabs({
  completedScenarioIds,
  quizCompleted,
  completedVisualActivityIds,
  completeScenario,
  completeVisualActivity,
  completeQuiz,
  learningAccess,
}) {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => (
        <LiquidGlassTabBar
          {...props}
        />
      )}
    >
      <Tab.Screen
        name="Home"
        component={
          HomeScreen
        }
        options={{
          tabBarLabel: "Home",
        }}
      />

      <Tab.Screen
        name="NearbyCooling"
        component={
          NearbyCoolingScreen
        }
        options={{
          tabBarLabel: "Cooling",
        }}
      />

      <Tab.Screen
        name="HeatAwareActivityPlanner"
        component={
          PlannerStackNavigator
        }
        options={{
          tabBarLabel: "Planner",
        }}
      />

      <Tab.Screen
        name="HeatSmartLearning"
        options={{
          tabBarLabel: "Learn",
        }}
      >
        {(props) => (
          <LearningStackNavigator
            {...props}
            completedScenarioIds={
              completedScenarioIds
            }
            quizCompleted={
              quizCompleted
            }
            completedVisualActivityIds={
              completedVisualActivityIds
            }
            completeScenario={
              completeScenario
            }
            completeVisualActivity={
              completeVisualActivity
            }
            completeQuiz={
              completeQuiz
            }
            learningAccess={
              learningAccess
            }
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}


/* =========================================================
   APP

   Theme provider remains outside ThemedApp so all screens,
   tabs and overlays can use the selected theme.
========================================================= */

export default function App() {
  return (
    <AppThemeProvider>
      <ThemedApp />
    </AppThemeProvider>
  );
}


/* =========================================================
   THEMED APP
========================================================= */

function ThemedApp() {
  const theme =
    useAppTheme();


  /* ---------------------------------------------------------
     HEAT SMART LEARNING PROGRESS
  --------------------------------------------------------- */

  // Completion persists while navigating but resets on reload.
  const [
    completedScenarioIds,
    setCompletedScenarioIds,
  ] = useState([]);

  const [
    quizCompleted,
    setQuizCompleted,
  ] = useState(false);

  const [
    completedVisualActivityIds,
    setCompletedVisualActivityIds,
  ] = useState([]);


  /*
   * Calculate which learning modules are currently unlocked.
   *
   * This fixes the earlier:
   *
   * ReferenceError:
   * getLearningAccess is not defined
   *
   * because the function is now imported and used here.
   */
  const learningAccess =
    getLearningAccess(
      completedVisualActivityIds,
      completedScenarioIds
    );


  /* ---------------------------------------------------------
     MINI MAP STATE
  --------------------------------------------------------- */

  const navigationRef =
    useRef(null);

  const restoringMiniMap =
    useRef(false);

  const miniMapSession =
    useRef(null);

  const [
    miniMapRoute,
    setMiniMapRoute,
  ] = useState(null);

  const [
    currentScreen,
    setCurrentScreen,
  ] = useState(null);

  const [
    googleMapsError,
    setGoogleMapsError,
  ] = useState(null);

  const googleMapsLauncher =
    useRef(null);


  /* ---------------------------------------------------------
     MINI MAP FUNCTIONS
  --------------------------------------------------------- */

  const activateMiniMap =
    (snapshot) => {
      setGoogleMapsError(null);

      miniMapSession.current =
        snapshot;

      setMiniMapRoute(
        snapshot
      );
    };


  const openGoogleMaps =
    (params) => {
      if (
        !googleMapsLauncher.current
      ) {
        googleMapsLauncher.current =
          createGoogleMapsLauncher(
            activateMiniMap,
            setGoogleMapsError
          );
      }

      return (
        googleMapsLauncher.current(
          params
        )
      );
    };


  const updateCurrentScreen =
    () => {
      setCurrentScreen(
        navigationRef.current
          ?.getCurrentRoute()
          ?.name ?? null
      );

      restoringMiniMap.current =
        false;
    };


  const restoreMiniMap =
    () => {
      const snapshot =
        miniMapSession.current;

      /*
       * If the minimised route came from Google Maps,
       * reopen Google Maps rather than restoring an
       * internal CoolingNavigation screen.
       */
      if (
        snapshot?.mode ===
        "googleMaps"
      ) {
        openGoogleMaps(
          snapshot
        );

        return;
      }

      if (
        !snapshot ||
        !navigationRef.current ||
        restoringMiniMap.current
      ) {
        return;
      }

      restoringMiniMap.current =
        true;

      miniMapSession.current =
        null;

      try {
        restoreCoolingRoute(
          navigationRef.current,
          snapshot,
          StackActions.popTo
        );

        setMiniMapRoute(null);
      }
      catch (error) {
        miniMapSession.current =
          snapshot;

        throw error;
      }
      finally {
        restoringMiniMap.current =
          false;
      }
    };


  const closeMiniMap =
    () => {
      setGoogleMapsError(null);

      miniMapSession.current =
        null;

      setMiniMapRoute(null);
    };


  /* ---------------------------------------------------------
     LEARNING COMPLETION FUNCTIONS
  --------------------------------------------------------- */

  function completeVisualActivity(
    activityId
  ) {
    setCompletedVisualActivityIds(
      (previousIds) =>
        previousIds.includes(
          activityId
        )
          ? previousIds
          : [
              ...previousIds,
              activityId,
            ]
    );
  }


  function completeScenario(
    scenarioId
  ) {
    setCompletedScenarioIds(
      (previousIds) =>
        previousIds.includes(
          scenarioId
        )
          ? previousIds
          : [
              ...previousIds,
              scenarioId,
            ]
    );
  }


  /* ---------------------------------------------------------
     NAVIGATION THEME
  --------------------------------------------------------- */

  const navigationTheme = {
    ...(
      theme.dark
        ? DarkTheme
        : DefaultTheme
    ),

    colors: {
      ...(
        theme.dark
          ? DarkTheme.colors
          : DefaultTheme.colors
      ),

      background:
        theme.colors.background,

      card:
        theme.colors.surface,

      text:
        theme.colors.text,

      border:
        theme.colors.border,

      primary:
        theme.colors.primary,
    },
  };


  /* ---------------------------------------------------------
     RENDER
  --------------------------------------------------------- */

  return (
    <SafeAreaProvider>
      <StatusBar
        style={
          theme.dark
            ? "light"
            : "dark"
        }
      />

      {/*
        MiniMapProvider wraps navigation so Nearby Cooling /
        Cooling Navigation can minimise their route into the
        floating overlay.
      */}
      <MiniMapProvider
        onMinimize={
          activateMiniMap
        }
        onOpenGoogleMaps={
          openGoogleMaps
        }
      >
        <View
          style={{
            flex: 1,
            backgroundColor:
              theme.colors.background,
          }}
        >
          <NavigationContainer
            ref={
              navigationRef
            }
            theme={
              navigationTheme
            }
            onReady={
              updateCurrentScreen
            }
            onStateChange={
              updateCurrentScreen
            }
          >
            <RootStack.Navigator
              initialRouteName="MainTabs"
              screenOptions={{
                headerShown: false,
              }}
            >
              {/* Main themed bottom-tab interface */}
              <RootStack.Screen
                name="MainTabs"
              >
                {() => (
                  <MainTabs
                    completedScenarioIds={
                      completedScenarioIds
                    }
                    quizCompleted={
                      quizCompleted
                    }
                    completedVisualActivityIds={
                      completedVisualActivityIds
                    }
                    completeScenario={
                      completeScenario
                    }
                    completeVisualActivity={
                      completeVisualActivity
                    }
                    completeQuiz={() =>
                      setQuizCompleted(
                        true
                      )
                    }
                    learningAccess={
                      learningAccess
                    }
                  />
                )}
              </RootStack.Screen>

              {/*
                Cooling Navigation remains a root screen
                because it is used by the floating Mini Map
                workflow.
              */}
              <RootStack.Screen
                name="CoolingNavigation"
                component={
                  CoolingNavigationScreen
                }
              />

              {/* Feedback flow remains outside the bottom tabs */}
              <RootStack.Screen
                name="FeedbackFormList"
                component={
                  FeedbackFormListScreen
                }
              />

              <RootStack.Screen
                name="FeedbackForm"
                component={
                  FeedbackFormScreen
                }
              />
            </RootStack.Navigator>
          </NavigationContainer>

          {/*
            Floating Mini Map is outside NavigationContainer
            visually, but shares the root navigation reference.
          */}
          <MiniMapOverlay
            snapshot={
              miniMapRoute
            }
            currentScreen={
              currentScreen
            }
            onRestore={
              restoreMiniMap
            }
            onClose={
              closeMiniMap
            }
            launchError={
              googleMapsError
            }
          />
        </View>
      </MiniMapProvider>
    </SafeAreaProvider>
  );
}