const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = relativePath => fs.readFileSync(
  path.resolve(__dirname, relativePath),
  'utf8',
);

const plannerSource = read('../screens/HeatAwareActivityPlannerScreen.js');
const detailsSource = read('../screens/EventDetailsScreen.js');
const recommendationSource = read('../components/ActivityRecommendationContent.js');

test('planner keeps the only Add Event action in the schedule header', () => {
  const plannerHeader = plannerSource.slice(
    plannerSource.indexOf('<View style={styles.plannerHeader}>'),
    plannerSource.indexOf('</View>', plannerSource.indexOf('<View style={styles.plannerHeader}>')) + 7,
  );

  assert.doesNotMatch(plannerSource, /Planning for/);
  assert.match(plannerHeader, /Your schedule/);
  assert.match(plannerHeader, /onPress=\{handleAddEvent\}/);
  assert.match(plannerHeader, />\s*Add Event\s*</);
  assert.equal((plannerSource.match(/>\s*Add Event\s*</g) || []).length, 1);
  assert.equal((plannerSource.match(/onPress=\{handleAddEvent\}/g) || []).length, 1);
  assert.equal((plannerSource.match(/navigation\.navigate\(\s*"EventPlanner"/g) || []).length, 1);
});

test('saved events use equal-height cards with a separate duration rail', () => {
  assert.match(plannerSource, /AGENDA_CARD_HEIGHT/);
  assert.match(plannerSource, /styles\.timelineAgenda/);
  assert.match(plannerSource, /styles\.agendaEventRow/);
  assert.match(plannerSource, /styles\.agendaTimeColumn/);
  assert.match(plannerSource, /styles\.agendaRail/);
  assert.match(plannerSource, /styles\.agendaRailLine/);
  assert.match(plannerSource, /styles\.agendaRailDot/);
  assert.match(plannerSource, /height:\s*AGENDA_CARD_HEIGHT/);
  assert.match(plannerSource, /formatSavedEventRange\(event\)/);
  assert.match(plannerSource, /formatStoredTime\(\s*event\.startTime\s*\)/);
  assert.match(plannerSource, /formatStoredTime\(\s*event\.endTime\s*\)/);
  assert.doesNotMatch(plannerSource, /getEventCardDensity/);
  assert.doesNotMatch(plannerSource, /getEventIconSize/);
  assert.doesNotMatch(plannerSource, /\{\s*top,\s*height\s*\}/);
});

test('schedule removes the old hour grid and collapsed-row affordances', () => {
  assert.doesNotMatch(plannerSource, /styles\.hourLine/);
  assert.doesNotMatch(plannerSource, /styles\.collapsedTimeRow/);
  assert.doesNotMatch(plannerSource, /name="chevron-down"/);
});

test('Today empty state is informative without a second add action', () => {
  assert.match(plannerSource, /No activities planned today/);
  assert.match(plannerSource, /Add an activity to receive\s*heat and UV guidance\./);
  assert.match(
    plannerSource,
    /styles\.emptyScheduleCard[\s\S]{0,800}name="calendar-outline"/,
  );
});

test('an empty Today previews tomorrow and can switch to it', () => {
  assert.match(plannerSource, /Coming up tomorrow/);
  assert.match(plannerSource, /View tomorrow/);
  assert.match(plannerSource, /styles\.tomorrowPreviewSection/);
  assert.match(plannerSource, /onPress=\{\(\) => setSelectedDay\(1\)\}/);
  assert.match(plannerSource, /selectedDay\s*===\s*0/);
  assert.match(plannerSource, /!hasTimelineEvents/);
  assert.match(plannerSource, /getTimelineEvents\(formatDateForApi\(days\[1\]\.date\)\)/);
  assert.match(plannerSource, /tomorrowTimelineEvents\.length\s*>\s*0/);
});

test('event details separates heat and UV conditions', () => {
  for (const hook of [
    'forecastCard',
    'forecastMetrics',
    'forecastMetric',
    'forecastMetricDivider',
    'forecastLabel',
    'forecastValue',
    'statusChip',
    'statusText',
  ]) {
    assert.match(detailsSource, new RegExp(`styles\\.${hook}`));
  }

  assert.match(detailsSource, />\s*Heat\s*</);
  assert.match(detailsSource, />\s*UV\s*</);
  assert.doesNotMatch(detailsSource, /join\(" • "\)/);
});

test('speech control shares the recommendation heading and removes its duplicate label', () => {
  assert.match(recommendationSource, /styles\.recommendationHeader/);
  assert.match(recommendationSource, /styles\.recommendationHeadingText/);
  assert.match(recommendationSource, /styles\.recommendationTitle/);
  assert.match(recommendationSource, /Activity Recommendation/);
  assert.match(recommendationSource, /styles\.speechButton/);

  const whatToDo = [...recommendationSource.matchAll(/What to do/g)];
  assert.ok(whatToDo.length <= 1);
  if (whatToDo.length === 1) {
    assert.match(
      recommendationSource.slice(Math.max(0, whatToDo[0].index - 240), whatToDo[0].index),
      /!enableSpeech/,
    );
  }
});

test('suggested alternative time is a designed information card', () => {
  for (const hook of [
    'alternativeCard',
    'alternativeIcon',
    'alternativeText',
    'alternativeTitle',
    'alternativeTime',
    'alternativeHint',
  ]) {
    assert.match(recommendationSource, new RegExp(`styles\\.${hook}`));
  }

  assert.match(recommendationSource, /Suggested alternative time/);
  assert.match(recommendationSource, /Lower UV period/);
  assert.match(recommendationSource, /styles\.alternativeMain/);
  assert.match(recommendationSource, /Use this time/);
  assert.match(recommendationSource, /alternativeMain: \{[^}]*alignItems: "center"/);
  assert.match(recommendationSource, /changeTimeButton: \{[^}]*alignSelf: "center"/);
  assert.match(recommendationSource, /changeTimeButton: \{[^}]*minHeight: 48/);
});
