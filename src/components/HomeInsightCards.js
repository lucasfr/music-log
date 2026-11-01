// Cards for Home, all built from what is already in the log (see utils/insights.js):
//  - the assignments from your latest lesson, as a checklist;
//  - which scales and arpeggios to practise today;
//  - a summary of everything since your last lesson, to read or send;
//  - what you usually do at the energy you have today.
// Each renders nothing when there is nothing to show, so Home only adds a line for them.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Platform } from 'react-native';
import { COLOURS, RADIUS, SIZES, TOUCH_PILL, HIT_PILL } from '../theme';
import { Ionicons } from './Icon';
import { Tap as TouchableOpacity } from './Motion';
import { fmtDate } from '../utils';
import { usePref } from '../utils/usePref';
import { parseMockHistory, freshFlags } from '../utils/mockExam';
import { dueFromMemory } from '../utils/memory';
import { performancePlanNudge } from '../utils/performancePlan';
import { yearProgress, monthProgress } from '../utils/goals';
import { parseNextLesson, lessonCountdown, parseQuestions, serializeQuestions, addQuestion, removeQuestion } from '../utils/lessonPrep';
import { setLessonReminder } from '../utils/reminders';
import { notify } from '../utils/notify';
import { tint } from '../utils/tint';
import { DatePickerF } from './Form';
import { LessonBriefModal } from './LessonBriefModal';
import { ENERGY_LABELS } from '../constants';
import {
  lessonAssignments, setAssignmentDone, suggestScope, energyLinks, describeLink,
  suggestScales, parseTarget, lessonBrief, weeklyReview, weeklyText, weeklyReviewDue, buildTodayPlan,
} from '../utils/insights';

const ENERGY_LEVELS = [-2, -1, 0, 1, 2];

// Every insight card has the same header as the tiles on the Start practice card: a tinted icon chip in the card's
// colour (`accent`, with `icon`), a short bold title and a dim line under it. `right` is a small element at the
// end of the header; with `onPress` the header taps to open and close the card (`expanded` says which).
function Card({ title, subtitle, children, accent = COLOURS.steel, icon, right, onPress, expanded }) {
  const Header = onPress ? TouchableOpacity : View;
  const headerProps = onPress
    ? { onPress, activeOpacity: 0.8, hitSlop: HIT_PILL, accessibilityRole: 'button', accessibilityState: { expanded: !!expanded }, accessibilityLabel: `${title}. ${subtitle || ''}`.trim() }
    : {};
  return (
    <View style={{
      borderRadius: RADIUS.md, backgroundColor: COLOURS.w(0.5), borderWidth: 1, borderColor: COLOURS.w(0.6), padding: 16, marginBottom: 12,
      shadowColor: COLOURS.shadow(0.08), shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
    }}>
      <Header {...headerProps} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 38 }}>
        {icon ? (
          <View style={{ width: 38, height: 38, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: tint(accent, 0.22) }}>
            <Ionicons name={icon} size={20} color={accent} />
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.body, color: COLOURS.text }}>{title}</Text>
          {subtitle ? <Text numberOfLines={2} style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 2 }}>{subtitle}</Text> : null}
        </View>
        {right || null}
      </Header>
      {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
    </View>
  );
}

// ─── Lesson assignments ──────────────────────────────────────────────────────

function LessonChecklist({ lessons, sessions, compositions, today, onSaveLesson }) {
  const { items, open, lessonDate } = useMemo(
    () => lessonAssignments(lessons, sessions, today, compositions),
    [lessons, sessions, today, compositions],
  );
  if (!items.length) return null;

  // A ticked item is un-ticked by tapping it again. One that is covered because you practised it
  // is evidence rather than a tick, so there is nothing to change.
  async function toggle(item) {
    if (item.status === 'covered') return;
    const lesson = (lessons || []).find(l => l.id === item.lessonId);
    if (!lesson) return;
    const ref = { segmentId: item.segmentId, segmentIndex: item.segmentIndex };
    await onSaveLesson(setAssignmentDone(lesson, ref, item.status !== 'done', today));
  }

  return (
    <Card accent={COLOURS.amber} icon="checkmark-circle-outline" title="From your lesson" subtitle={`${fmtDate(lessonDate)} \u00b7 ${open > 0 ? `${open} to do` : 'all done'}`}>
      {items.map(it => {
        const finished = it.status !== 'open';
        return (
          <TouchableOpacity
            key={`${it.lessonId}:${it.segmentId ?? it.segmentIndex}`}
            onPress={() => toggle(it)}
            activeOpacity={0.75}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: finished }}
            accessibilityLabel={`${it.label}: ${it.text}`}
            style={{ flexDirection: 'row', gap: 12, paddingVertical: 8, minHeight: 44 }}
          >
            {finished
              ? <Ionicons name="checkmark-circle-outline" size={24} color={it.status === 'done' ? COLOURS.success : COLOURS.steel} />
              : <View style={{ width: 24, height: 24, borderRadius: RADIUS.pill, borderWidth: 2, borderColor: COLOURS.navyA(0.35) }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: finished ? COLOURS.textDim : COLOURS.text }}>{it.label}</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, lineHeight: 18 }}>{it.text}</Text>
              {it.status === 'covered' ? (
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.steel, marginTop: 2 }}>Practised {fmtDate(it.coveredOn)}</Text>
              ) : null}
              {it.lessonDate !== lessonDate ? (
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginTop: 2 }}>From the lesson on {fmtDate(it.lessonDate)}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </Card>
  );
}

// ─── Energy and scope ────────────────────────────────────────────────────────

function scopeText(s) {
  const level = ENERGY_LABELS[String(s.energy)].toLowerCase();
  let text = `${s.widened ? `On ${level} days, and the levels either side,` : `On ${level} days`} you usually play about ${s.minutes} min`;
  if (s.techniqueShare !== null) {
    const tech = Math.round(s.techniqueShare * 100);
    text += `, roughly ${tech}% technique and ${100 - tech}% pieces`;
  }
  if (s.avgEnjoyment !== null) text += `, and rate those sessions ${s.avgEnjoyment} out of 5`;
  return `${text}.`;
}

function EnergyScope({ sessions }) {
  const [energy, setEnergy] = useState(null);
  const scope = useMemo(() => (energy === null ? null : suggestScope(sessions, energy)), [sessions, energy]);
  const links = useMemo(() => energyLinks(sessions), [sessions]);
  if (!sessions.length) return null;

  const linkLines = [];
  if (links.enjoyment !== null) linkLines.push(`energy and enjoyment show ${describeLink(links.enjoyment, 'enjoyment')}`);
  if (links.minutes !== null) linkLines.push(`energy and session length show ${describeLink(links.minutes, 'length')}`);

  return (
    <Card accent={COLOURS.success} icon="pulse-outline" title="How much energy have you got?" subtitle="See what you usually do on days like this">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ENERGY_LEVELS.map(level => {
          const active = energy === level;
          const label = ENERGY_LABELS[String(level)];
          return (
            <TouchableOpacity
              key={level}
              onPress={() => setEnergy(active ? null : level)}
              activeOpacity={0.75}
              hitSlop={HIT_PILL}
              accessibilityRole="radio"
              accessibilityLabel={`Energy: ${label}`}
              accessibilityState={{ selected: active }}
              style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: active ? COLOURS.navy : COLOURS.navyA(0.10) }}
            >
              <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: SIZES.bodySmall, color: active ? COLOURS.onNavy : COLOURS.textMuted }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {scope ? (
        <View style={{ marginTop: 12 }}>
          {scope.enough ? (
            <>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.cardTitle, color: COLOURS.text, lineHeight: 24 }}>{scopeText(scope)}</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginTop: 6 }}>
                Based on {scope.n} of your sessions. It is what you have done before, not a target.
              </Text>
            </>
          ) : (
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.textDim, lineHeight: 22 }}>
              Not enough sessions at this energy yet ({scope.n} so far; it needs 3). Keep logging energy and this fills in.
            </Text>
          )}
        </View>
      ) : null}

      {linkLines.length ? (
        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginTop: 10, lineHeight: 17 }}>
          Across {links.n} sessions, {linkLines.join('; ')}.
        </Text>
      ) : null}
    </Card>
  );
}

// ─── Scales for today ────────────────────────────────────
// From your grade target if you have set one: what you have never practised, then what has been
// left longest. Otherwise the scales you used to play and have let slip.

const SCALE_STATUS_COLOUR = { never: COLOURS.red, stale: COLOURS.amber, recent: COLOURS.steel };

function TodaysScales({ sessions, today }) {
  const [targetRaw] = usePref('gradeTarget', '');
  const target = useMemo(() => parseTarget(targetRaw), [targetRaw]);
  const items = useMemo(() => suggestScales(target, sessions, today), [target, sessions, today]);
  if (!items.length) return null;
  const fromTarget = items.some(x => x.fromTarget);
  return (
    <Card accent={COLOURS.red} icon="musical-notes-outline" title="Scales for today" subtitle={fromTarget ? 'From your grade target, the ones that need it most' : 'Ones you have let slip'}>
      {items.map(x => (
        <View
          key={`${x.group}|${x.label}`}
          accessible
          accessibilityLabel={`${x.label}, ${x.reason}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
        >
          <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: SCALE_STATUS_COLOUR[x.status] }} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.text }}>{x.label}</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginTop: 1 }}>
              {x.group === 'Arpeggios' ? 'Arpeggio' : 'Scale'} {'\u00b7'} {x.reason}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

// ─── Lesson summary ───────────────────────────────────────────────
// Everything since the last lesson, on one screen that can be copied or shared.

const minutesText = m => {
  const r = Math.round(m);
  return r >= 60 ? `${Math.floor(r / 60)}h ${r % 60}m` : `${r}m`;
};

function LessonBriefCard({ lessons, sessions, compositions, today }) {
  const [open, setOpen] = useState(false);
  const [questionsRaw] = usePref('teacherQuestions', '[]');
  const brief = useMemo(() => lessonBrief(lessons, sessions, compositions, today, { questions: parseQuestions(questionsRaw).map(q => q.text) }), [lessons, sessions, compositions, today, questionsRaw]);
  if (!brief.totals.sessions && !brief.period.hasLesson) return null;

  const { totals, runThroughs, period } = brief;
  const when = period.hasLesson ? `Since your lesson on ${fmtDate(period.since)}` : 'Over the last 4 weeks';
  const what = totals.sessions === 0
    ? 'No practice logged yet.'
    : `${totals.sessions} ${totals.sessions === 1 ? 'session' : 'sessions'}, ${minutesText(totals.minutes)}${runThroughs ? `, ${runThroughs} ${runThroughs === 1 ? 'run-through' : 'run-throughs'}` : ''}.`;

  return (
    <Card accent={COLOURS.gold} icon="journal-outline" title="Lesson summary" subtitle={when}>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.text, lineHeight: 20 }}>{what}</Text>
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <TouchableOpacity
          onPress={() => setOpen(true)} activeOpacity={0.75} hitSlop={HIT_PILL}
          accessibilityRole="button" accessibilityLabel="Open the lesson summary"
          style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy }}
        >
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.onNavy }}>Open summary</Text>
        </TouchableOpacity>
      </View>
      <LessonBriefModal visible={open} brief={brief} onClose={() => setOpen(false)} />
    </Card>
  );
}

// ─── Last week ─────────────────────────────────────────────────
// On Monday, Tuesday and Wednesday, a short review of the week just gone and what to carry into this one.

function WeeklyReviewCard({ lessons, sessions, compositions, today }) {
  const [open, setOpen] = useState(false);
  const due = weeklyReviewDue(today);
  const review = useMemo(() => (due ? weeklyReview(lessons, sessions, compositions, today) : null), [due, lessons, sessions, compositions, today]);
  const text = useMemo(() => (review ? weeklyText(review) : ''), [review]);
  if (!review || !review.brief.totals.sessions) return null;

  const { totals, runThroughs } = review.brief;
  const what = `${totals.sessions} ${totals.sessions === 1 ? 'session' : 'sessions'}, ${minutesText(totals.minutes)}${runThroughs ? `, ${runThroughs} ${runThroughs === 1 ? 'run-through' : 'run-throughs'}` : ''}.`;

  return (
    <Card accent={COLOURS.steel} icon="calendar-outline" title="Last week" subtitle={`${fmtDate(review.week.from)} to ${fmtDate(review.week.to)}`}>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.text, lineHeight: 20 }}>{what}</Text>
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <TouchableOpacity
          onPress={() => setOpen(true)} activeOpacity={0.75} hitSlop={HIT_PILL}
          accessibilityRole="button" accessibilityLabel="Open the review of last week"
          style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy }}
        >
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.onNavy }}>Open review</Text>
        </TouchableOpacity>
      </View>
      <LessonBriefModal visible={open} text={text} title="Week in review" onClose={() => setOpen(false)} />
    </Card>
  );
}

// ─── Today's plan ──────────────────────────────────────────────────────────────────
// A routine built from what needs attention (see buildTodayPlan), started with one tap. Not shown once
// you have practised today, when it has nothing to add.

function TodaysPlanCard({ sessions, lessons, compositions, today, practicedToday, onStartPlan }) {
  const [targetRaw] = usePref('gradeTarget', '');
  // What the latest mock exam flagged shapes the plan for two weeks (see utils/mockExam.js).
  const [mockRaw] = usePref('mockExamHistory', '[]');
  const mockFlags = useMemo(() => freshFlags(parseMockHistory(mockRaw), today), [mockRaw, today]);
  const target = useMemo(() => parseTarget(targetRaw), [targetRaw]);
  const plan = useMemo(
    () => buildTodayPlan(target, sessions, lessons, compositions, today, {
      examDate: (target && target.date) || null,
      mockFlags,
      // insights.js has no imports of its own (see its header), so the memory and performance logic is passed in.
      memoryDue: dueFromMemory(compositions, today),
      performanceNudge: performancePlanNudge,
    }),
    [target, sessions, lessons, compositions, today, mockFlags],
  );
  if (practicedToday || !onStartPlan || !plan.items.length) return null;
  return (
    <Card
      accent={COLOURS.steel} icon="sparkles-outline" title="Today's plan" subtitle="From what needs attention"
      right={(
        <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: tint(COLOURS.steel, 0.22) }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text }}>{plan.minutes} min</Text>
        </View>
      )}
    >
      {plan.items.map((x, i) => (
        <View
          key={`${x.kind}-${x.title}-${i}`}
          accessible
          accessibilityLabel={`${x.title}, ${x.minutes} minutes, ${x.reason}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: COLOURS.navyA(0.08) }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.text }}>{x.title}</Text>
            <Text numberOfLines={1} style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginTop: 1 }}>{x.reason}</Text>
          </View>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted }}>{x.minutes} min</Text>
        </View>
      ))}
      <TouchableOpacity
        onPress={() => onStartPlan(plan.segments)} activeOpacity={0.85} hitSlop={HIT_PILL}
        accessibilityRole="button" accessibilityLabel={`Start today's plan, ${plan.minutes} minutes`}
        style={{ minHeight: 48, marginTop: 12, paddingHorizontal: 22, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        <Ionicons name="play" size={18} color={COLOURS.onNavy} />
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.body, color: COLOURS.onNavy }}>Start today's plan</Text>
      </TouchableOpacity>
    </Card>
  );
}

// ─── Reference cards, folded away ─────────────────────────────────────────
// The cards worth acting on today stay on top; the rest are one tap away, and Home remembers whether
// you left them open.

function MoreInsights({ children }) {
  const [open, setOpen] = usePref('homeInsightsOpen', '0');
  const isOpen = open === '1';
  return (
    <View style={{ marginBottom: 16 }}>
      <TouchableOpacity
        onPress={() => setOpen(isOpen ? '0' : '1')} activeOpacity={0.8} hitSlop={HIT_PILL}
        accessibilityRole="button" accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={isOpen ? 'Hide more insights' : 'Show more insights'}
        style={{ ...TOUCH_PILL, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}
      >
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>More insights</Text>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={COLOURS.textDim} />
      </TouchableOpacity>
      {isOpen ? <View style={{ marginTop: 8 }}>{children}</View> : null}
    </View>
  );
}

// ─── Next lesson ────────────────────────────────────────────────────────────────────
// The date of your next lesson, a countdown, a running list of questions for your teacher (they go into the lesson
// summary), and, in the app, a reminder the evening before (see utils/lessonPrep.js and utils/reminderPlan.js).

function NextLessonCard({ today }) {
  const [dateRaw, setDateRaw] = usePref('nextLesson', '');
  const [questionsRaw, setQuestionsRaw] = usePref('teacherQuestions', '[]');
  const [remindOn, setRemindOn] = usePref('lessonReminderOn', '');
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const date = parseNextLesson(dateRaw);
  const countdown = lessonCountdown(date, today);
  const questions = useMemo(() => parseQuestions(questionsRaw), [questionsRaw]);
  const native = Platform.OS !== 'web';

  const changeDate = d => {
    setDateRaw(d || '');
    if (remindOn === '1' && native) setLessonReminder(d || '', today);
  };
  const add = () => {
    if (!text.trim()) return;
    setQuestionsRaw(serializeQuestions(addQuestion(questions, text, today)));
    setText('');
  };
  const toggleReminder = async () => {
    if (remindOn === '1') { await setLessonReminder('', today); setRemindOn(''); return; }
    const r = await setLessonReminder(date, today);
    if (!r.ok) { notify('Reminder not set', r.reason); return; }
    setRemindOn('1');
  };
  // Closed, the card is one row: the countdown and how many questions are waiting. Open, it is the editor.
  const nq = questions.length;
  const qWords = `${nq} ${nq === 1 ? 'question' : 'questions'}`;
  const sub = countdown
    ? `${countdown.line.replace(/\.$/, '')}${nq ? ` \u00b7 ${qWords}` : ''}`
    : nq ? `${qWords} saved` : 'Add the date and your questions';

  return (
    <Card
      accent={COLOURS.amber} icon="school-outline" title="Next lesson" subtitle={sub}
      onPress={() => setOpen(o => !o)} expanded={open}
      right={<Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={COLOURS.textDim} />}
    >
      {open ? (
      <>
      <DatePickerF label="Lesson date" value={date} onChange={changeDate} icon="calendar-outline" />
      {questions.map(q => (
        <View key={q.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <Text style={{ flex: 1, fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.text, lineHeight: 20 }}>{q.text}</Text>
          <TouchableOpacity onPress={() => setQuestionsRaw(serializeQuestions(removeQuestion(questions, q.id)))} hitSlop={HIT_PILL}
            accessibilityRole="button" accessibilityLabel={`Remove the question: ${q.text}`}>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.sectionTitle, lineHeight: 24, color: COLOURS.textDim }}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <TextInput value={text} onChangeText={setText} onSubmitEditing={add} returnKeyType="done" placeholder="A question for your teacher" placeholderTextColor={COLOURS.textDim}
          accessibilityLabel="Add a question for your teacher"
          style={{ flex: 1, fontFamily: 'Lato', fontSize: SIZES.body, color: COLOURS.text, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: COLOURS.w(0.6), borderWidth: 1, borderColor: COLOURS.glassBorder }} />
        <TouchableOpacity onPress={add} hitSlop={HIT_PILL} accessibilityRole="button" accessibilityLabel="Add question"
          style={{ paddingHorizontal: 16, justifyContent: 'center', borderRadius: RADIUS.md, backgroundColor: COLOURS.steel }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.onNavy }}>Add</Text>
        </TouchableOpacity>
      </View>
      {native && date && countdown && !countdown.passed ? (
        <TouchableOpacity onPress={toggleReminder} hitSlop={HIT_PILL} accessibilityRole="button" accessibilityState={{ selected: remindOn === '1' }}
          accessibilityLabel={remindOn === '1' ? 'The reminder the evening before is on. Tap to turn it off' : 'Remind me the evening before'}
          style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 8 }}>
          <Text style={{ fontFamily: remindOn === '1' ? 'Lato-Bold' : 'Lato', fontSize: SIZES.label, color: COLOURS.steel }}>{remindOn === '1' ? 'Reminder on: the evening before at 18:00' : 'Remind me the evening before'}</Text>
        </TouchableOpacity>
      ) : null}
      {countdown && countdown.passed && questions.length ? (
        <TouchableOpacity onPress={() => { setQuestionsRaw('[]'); setDateRaw(''); }} hitSlop={HIT_PILL} accessibilityRole="button"
          accessibilityLabel="Clear the questions and the date now the lesson is over"
          style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 8 }}>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.steel }}>The lesson is over: clear the questions</Text>
        </TouchableOpacity>
      ) : null}
      </>
      ) : null}
    </Card>
  );
}

// ─── Monthly and yearly goals ──────────────────────────────────────────────────────────────
// Hours against the goals you set in Settings → Practice, and whether that is ahead of an even pace (see
// utils/goals.js). Nothing is shown until a goal is set.

const GOAL_WORDS = { ahead: 'Ahead of pace', on: 'On pace', done: 'Goal reached' };

// One goal as a column: the label, the hours so far over the goal, a bar with a mark where an even pace would be, and
// one short line on how it is going. The two goals sit side by side.
function GoalColumn({ label, p }) {
  const colour = p.status === 'behind' ? COLOURS.amber : p.status === 'on' ? COLOURS.steel : COLOURS.success;
  const words = p.status === 'behind'
    ? (p.catchUpMinutes > 0 ? `Behind: about ${p.catchUpMinutes} min a day to catch up` : 'Behind pace')
    : GOAL_WORDS[p.status];
  return (
    <View accessible accessibilityLabel={`${label}: ${p.line}`} style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.display, color: COLOURS.text, fontVariant: ['lining-nums'] }}>{p.hours}</Text>
        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>/ {p.goal} h</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: COLOURS.navyA(0.10), overflow: 'hidden', marginTop: 6 }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(p.fraction * 100)}%`, backgroundColor: colour }} />
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(100, Math.round((p.expected / p.goal) * 100))}%`, width: 2, backgroundColor: COLOURS.navyA(0.45) }} />
      </View>
      <Text numberOfLines={2} style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: p.status === 'behind' ? COLOURS.amber : COLOURS.textDim, marginTop: 6 }}>{words}</Text>
    </View>
  );
}

function GoalsCard({ sessions, today }) {
  const [monthRaw] = usePref('monthGoalHours', '0');
  const [yearRaw] = usePref('yearGoalHours', '0');
  const month = useMemo(() => monthProgress(sessions, today, Number(monthRaw)), [sessions, today, monthRaw]);
  const year = useMemo(() => yearProgress(sessions, today, Number(yearRaw)), [sessions, today, yearRaw]);
  if (!month && !year) return null;
  return (
    <Card accent={COLOURS.steel} icon="speedometer-outline" title="Goals" subtitle="Hours against an even pace">
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {month ? <GoalColumn label="This month" p={month} /> : null}
        {year ? <GoalColumn label="This year" p={year} /> : null}
      </View>
    </Card>
  );
}

// Today's plan sits right under Start practice on Home, so it is its own export; the rest of the cards follow the week.
export function HomePlanCard(props) {
  return <TodaysPlanCard {...props} />;
}

export function HomeInsightCards({ sessions, lessons, compositions, today, onSaveLesson }) {
  return (
    <>
      <NextLessonCard today={today} />
      <GoalsCard sessions={sessions} today={today} />
      <LessonChecklist lessons={lessons} sessions={sessions} compositions={compositions} today={today} onSaveLesson={onSaveLesson} />
      <WeeklyReviewCard lessons={lessons} sessions={sessions} compositions={compositions} today={today} />
      <MoreInsights>
        <TodaysScales sessions={sessions} today={today} />
        <LessonBriefCard lessons={lessons} sessions={sessions} compositions={compositions} today={today} />
        <EnergyScope sessions={sessions} />
      </MoreInsights>
    </>
  );
}
