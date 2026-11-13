import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLOURS, RADIUS, SIZES, TOUCH_PILL, HIT_PILL } from '../theme';
import { LogModal } from '../components/LogModal';
import { LessonModal } from '../components/LessonModal';
import { SessionDetailModal } from '../components/SessionDetailModal';
import { LessonDetailModal } from '../components/LessonDetailModal';
import { localISO, getLocalPref, setLocalPref, latestSession, sessionToTimerPlan } from '../utils';
import { exportAllJSON } from '../utils/export';
import AboutScreen from './AboutScreen';
import { FAB } from '../components/FAB';
import { TimerSetupModal } from '../components/TimerSetupModal';
import { weekSummary, latestFocus, currentStreak as streakFrom, parseRestDays } from '../utils/progress';
import { usePref } from '../utils/usePref';
import { goalProgress, backupNudge, snoozeUntil, parseRoutines, todaySummary } from '../utils/planning';
import { Ionicons } from '../components/Icon';
import { SNAPSHOT_KEY, parseSnapshot, snapshotSummary, worthResuming } from '../utils/timerSnapshot';
import { timerToLogSegments } from '../utils/timerLog';
import { SyncIssueBanner } from '../components/SyncIssueBanner';
import { FadeInUp, Tap as TouchableOpacity } from '../components/Motion';
import { delayFor } from '../utils/motion';
import { HomeInsightCards, HomePlanCard } from '../components/HomeInsightCards';
import { tempoSuggestionMap } from '../utils/insights';
import { PracticeTimerScreen } from '../components/PracticeTimerScreen';
import { useNavScrollHandler } from '../context/NavScrollContext';
import { todayISO } from './home/helpers';
import { PracticeEntry, LessonEntry } from './home/entries';
import { NextUpCard, WeekStrip, ResumeTimerCard, StartPracticeCard, BackupNudge } from './home/cards';
import { DesktopDetailPanel } from './home/DesktopDetailPanel';

// Home. The parts it is built from are in ./home (the feed's entry cards, the smaller cards, and the
// desktop detail panel); this file keeps the screen itself: its state, the feed, and the desktop and
// mobile layouts.

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen({ sessions, lessons, compositions, onSave, onSaveLesson, onSaveComposition, onDelete, onDeleteLesson, isDesktop, onOpenSettings }) {
  const today = todayISO();
  const [logModalDate,    setLogModalDate]    = useState(null);
  const [logModalSession, setLogModalSession] = useState(null);
  const [lessonModalDate, setLessonModalDate] = useState(null);
  const [lessonModalLesson, setLessonModalLesson] = useState(null);
  const [detailSession,   setDetailSession]   = useState(null);
  const [detailLesson,    setDetailLesson]    = useState(null);
  const [rightPanel,      setRightPanel]      = useState(null); // 'detail-session' | 'detail-lesson' | 'log-session' | 'log-lesson'
  const [showAbout,       setShowAbout]       = useState(false);
  const [timerSetupVisible, setTimerSetupVisible] = useState(false);
  const [timerSegments,     setTimerSegments]     = useState(null); // non-null while a timed session is running
  // A timer that was running when the app was closed, offered back as a Resume card.
  const [resumable,    setResumable]    = useState(() => {
    const saved = parseSnapshot(getLocalPref(SNAPSHOT_KEY, ''), Date.now());
    return saved && worthResuming(saved) ? saved : null;
  });
  const [timerRestore, setTimerRestore] = useState(null);
  const [sessionKey,        setSessionKey]        = useState(0);   // bumped per session so PracticeTimerScreen remounts cleanly
  const onNavScroll = useNavScrollHandler(); // must be called unconditionally, before the isDesktop early return below

  function openSession(s)  { if (isDesktop) { setDetailSession(s); setDetailLesson(null); setRightPanel('detail-session'); } else setDetailSession(s); }
  function openLesson(l)   { if (isDesktop) { setDetailLesson(l); setDetailSession(null); setRightPanel('detail-lesson'); } else setDetailLesson(l); }
  function openLogSession(date, session) {
    if (isDesktop) { setLogModalSession(session || null); setLogModalDate(date || today); setRightPanel('log-session'); }
    else { setLogModalSession(session || null); setLogModalDate(date || today); }
  }
  function openLogLesson(date, lesson) {
    if (isDesktop) { setLessonModalLesson(lesson || null); setLessonModalDate(date || today); setRightPanel('log-lesson'); }
    else { setLessonModalLesson(lesson || null); setLessonModalDate(date || today); }
  }
  function closeRight() { setRightPanel(null); setDetailSession(null); setDetailLesson(null); setLogModalDate(null); setLogModalSession(null); setLessonModalDate(null); setLessonModalLesson(null); }

  function handleTimerStart(segments) {
    setTimerRestore(null);
    setResumable(null);
    setTimerSegments(segments);
    setSessionKey(k => k + 1);
    setTimerSetupVisible(false);
  }

  function resumeTimer() {
    setTimerRestore(resumable);
    setTimerSegments(resumable.segments);
    setSessionKey(k => k + 1);
    setResumable(null);
  }
  function discardTimer() {
    setLocalPref(SNAPSHOT_KEY, '');
    setResumable(null);
  }

  function handleTimerFinish(timer) {
    // SegmentEditor's technique-group pills read segment.group (set via its
    // own field('group', g)), not segment.title — title there is only the
    // optional free-text label underneath. The timer's own group picker
    // (TimerSetupModal) stores the chosen group in title, so it has to be
    // remapped to group here or the pill shows nothing selected when the
    // log form opens, and saving without manually re-clicking it drops the
    // technique group entirely.
    const prefilled = timerToLogSegments(timer.segments, i => timer.actualMinutesFor(i));
    setTimerSegments(null);
    setTimerRestore(null);
    setLocalPref(SNAPSHOT_KEY, '');
    openLogSession(today, { date: today, segments: prefilled });
  }

  const todaySessions = useMemo(() => sessions.filter(s => s.date === today), [sessions, today]);
  const todayLessons  = useMemo(() => (lessons || []).filter(l => l.date === today), [lessons, today]);
  const hasToday = todaySessions.length > 0 || todayLessons.length > 0;
  // Once something is logged, Today folds to one summary line (open by default on desktop).
  const [todayOpen, setTodayOpen] = useState(!!isDesktop);
  // Today's entries ease in when you open them, but not when the screen first appears.
  const todayWasOpen = useRef(todayOpen);
  const todayJustOpened = todayOpen && !todayWasOpen.current;
  useEffect(() => { todayWasOpen.current = todayOpen; }, [todayOpen]);

  const [restRaw] = usePref('restDays', '[]');
  const currentStreak = useMemo(() => streakFrom(sessions, today, parseRestDays(restRaw)), [sessions, today, restRaw]);
  // The next tempo to try on each library piece, offered beside "Use piece tempo" in the metronome.
  const tempoSuggestions = useMemo(() => tempoSuggestionMap(sessions, compositions, today), [sessions, compositions, today]);

  const week   = useMemo(() => weekSummary(sessions, lessons, today), [sessions, lessons, today]);
  const nextUp = useMemo(() => latestFocus(sessions), [sessions]);
  // The previous Monday–Sunday week, shown on an empty week instead of three zeros.
  const lastWeek = useMemo(() => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - 7);
    return weekSummary(sessions, lessons, localISO(d));
  }, [sessions, lessons, today]);

  const [goalRaw] = usePref('weeklyGoalMin', '0');
  const goal = useMemo(() => goalProgress(week.minutes, goalRaw), [week.minutes, goalRaw]);
  const [lastBackup] = usePref('lastBackup', '');
  const [snoozedUntil] = usePref('backupSnoozedUntil', '');
  const [routinesRaw] = usePref('timerRoutines', '[]');
  const routines = useMemo(() => parseRoutines(routinesRaw), [routinesRaw]);
  const repeatPlan = useMemo(() => {
    const previous = latestSession(sessions);
    return previous ? sessionToTimerPlan(previous, compositions) : [];
  }, [sessions, compositions]);
  // A plan starts straight away only when every segment is ready to run; one that still needs
  // something chosen (say a piece that has since been deleted) opens the setup instead.
  function startPlan(plan) {
    if (plan.length > 0 && plan.every(s => s.confirmed)) {
      handleTimerStart(plan.map(({ confirmed, ...s }) => ({ ...s, plannedMinutes: Number(s.plannedMinutes) })));
    } else {
      setTimerSetupVisible(true);
    }
  }
  const backupDue = useMemo(() => backupNudge({
    lastBackup: lastBackup || null,
    snoozedUntil: snoozedUntil || null,
    today,
    sessionCount: sessions.length,
    firstSessionDate: sessions.reduce((min, s) => (!min || s.date < min ? s.date : min), null),
  }), [lastBackup, snoozedUntil, today, sessions]);

  const feedItems = useMemo(() => {
    const s = sessions.filter(s => s.date !== today).map(s => ({ ...s, _type: 'practice' }));
    const l = (lessons || []).filter(l => l.date !== today).map(l => ({ ...l, _type: 'lesson' }));
    return [...s, ...l].sort((a, b) =>
      b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }, [sessions, lessons, today]);

  const modals = (
    <>
      {!isDesktop && (
        <>
          <LogModal
            visible={!!logModalDate || !!logModalSession}
            initialDate={logModalSession?.date || logModalDate || ''}
            initialSession={logModalSession}
            previousSession={latestSession(sessions)}
            compositions={compositions}
            onSave={s => { onSave(s); setLogModalDate(null); setLogModalSession(null); }}
            onClose={() => { setLogModalDate(null); setLogModalSession(null); }}
          />
          <LessonModal
            visible={!!lessonModalDate || !!lessonModalLesson}
            initialDate={lessonModalLesson?.date || lessonModalDate || ''}
            initialLesson={lessonModalLesson}
            compositions={compositions}
            onSave={l => { onSaveLesson(l); setLessonModalDate(null); setLessonModalLesson(null); }}
            onClose={() => { setLessonModalDate(null); setLessonModalLesson(null); }}
          />
          <SessionDetailModal
            visible={!!detailSession}
            session={detailSession}
            compositions={compositions}
            onClose={() => setDetailSession(null)}
            onDelete={id => { onDelete(id); setDetailSession(null); }}
            onEdit={s => { setDetailSession(null); setLogModalSession(s); }}
          />
          <LessonDetailModal
            visible={!!detailLesson}
            lesson={detailLesson}
            compositions={compositions}
            onClose={() => setDetailLesson(null)}
            onDelete={id => { onDeleteLesson(id); setDetailLesson(null); }}
            onEdit={l => { setDetailLesson(null); setLessonModalLesson(l); }}
          />
        </>
      )}
    </>
  );

  // Feed column (shared between desktop and mobile)
  const feedContent = (
    <>
      {/* A sync problem that needs attention (never just being offline) */}
      <SyncIssueBanner onPress={onOpenSettings} />

      {/* A timer that was running when the app closed */}
      {resumable && !timerSegments ? (
        <ResumeTimerCard summary={snapshotSummary(resumable, Date.now())} onResume={resumeTimer} onDiscard={discardTimer} />
      ) : null}

      {/* Start practice */}
      <FadeInUp>
        <StartPracticeCard
          repeatPlan={repeatPlan}
          routines={routines}
          compositions={compositions}
          lastSession={latestSession(sessions)}
          today={today}
          onSetup={() => setTimerSetupVisible(true)}
          onStartPlan={startPlan}
        />
      </FadeInUp>

      {/* Today's plan: the one thing worth doing next, straight under Start practice (nothing once you have practised) */}
      {sessions.length > 0 || (lessons || []).length > 0 ? (
        <FadeInUp delay={delayFor(1)}>
          <HomePlanCard sessions={sessions} lessons={lessons || []} compositions={compositions} today={today} practicedToday={todaySessions.length > 0} onStartPlan={startPlan} />
        </FadeInUp>
      ) : null}

      {/* Today */}
      <FadeInUp>
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>Today</Text>
          {currentStreak > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.55), shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1 }}>
              <Text style={{ fontSize: SIZES.labelSmall }}>🔥</Text>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.navy }}>{currentStreak} day{currentStreak !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
        {hasToday ? (
          <View>
            <TouchableOpacity onPress={() => setTodayOpen(o => !o)} activeOpacity={0.8} hitSlop={HIT_PILL}
              accessibilityRole="button" accessibilityState={{ expanded: todayOpen }}
              accessibilityLabel={`${todaySummary(todaySessions, todayLessons)}. ${todayOpen ? 'Hide' : 'Show'} today's entries`}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: 14, borderRadius: RADIUS.md, backgroundColor: COLOURS.w(0.5) }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.body, color: COLOURS.text }}>{todaySummary(todaySessions, todayLessons)}</Text>
              <Ionicons name={todayOpen ? 'chevron-up' : 'chevron-down'} size={18} color={COLOURS.textDim} />
            </TouchableOpacity>
            {todayOpen ? (
          <FadeInUp skip={!todayJustOpened} distance={10}>
          <View style={{ gap: 10, marginTop: 10 }}>
            {todayLessons.map(l => (
              <LessonEntry key={l.id} lesson={l} compositions={compositions}
                isSelected={isDesktop && rightPanel === 'detail-lesson' && detailLesson?.id === l.id}
                onPress={() => openLesson(l)}
                showDate={false} />
            ))}
            {todaySessions.map(s => (
              <PracticeEntry key={s.id} session={s} compositions={compositions}
                isSelected={isDesktop && rightPanel === 'detail-session' && detailSession?.id === s.id}
                onPress={() => openSession(s)}
                showDate={false} />
            ))}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => openLogSession(today)} activeOpacity={0.8} hitSlop={HIT_PILL}
                accessibilityRole="button" accessibilityLabel="Log another practice today"
                style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.5) }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.practiceText }}>+ Log another practice</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openLogLesson(today)} activeOpacity={0.8} hitSlop={HIT_PILL}
                accessibilityRole="button" accessibilityLabel="Log a lesson today"
                style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.5) }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.lessonText }}>+ Log lesson</Text>
              </TouchableOpacity>
            </View>
          </View>
          </FadeInUp>
            ) : null}
          </View>
        ) : (
          <View>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.textDim }}>Nothing logged today yet. Even ten minutes counts.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity onPress={() => openLogSession(today)} activeOpacity={0.8}
                hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.float, borderWidth: 1, borderColor: COLOURS.w(0.9), shadowColor: COLOURS.accentMid, shadowOffset:{width:0,height:0}, shadowOpacity:0.45, shadowRadius:12, elevation:3 }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.practiceText }}>{'🎹 Log practice'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openLogLesson(today)} activeOpacity={0.8}
                hitSlop={HIT_PILL} style={{ ...TOUCH_PILL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.float, borderWidth: 1, borderColor: COLOURS.w(0.9), shadowColor: COLOURS.accent2Mid, shadowOffset:{width:0,height:0}, shadowOpacity:0.45, shadowRadius:12, elevation:3 }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.lessonText }}>{'🎓 Log lesson'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      </FadeInUp>

      {/* Next up (last session's focus) and this week's numbers */}
      {nextUp ? <FadeInUp delay={delayFor(1)}><NextUpCard focus={nextUp.focus} date={nextUp.date} /></FadeInUp> : null}
      {sessions.length > 0 ? <FadeInUp delay={delayFor(2)}><WeekStrip week={week} lastWeek={lastWeek} goal={goal} streak={currentStreak} /></FadeInUp> : null}
      {sessions.length > 0 || (lessons || []).length > 0 ? (
        <FadeInUp delay={delayFor(3)}>
          <HomeInsightCards sessions={sessions} lessons={lessons || []} compositions={compositions} today={today} onSaveLesson={onSaveLesson} />
        </FadeInUp>
      ) : null}
      {backupDue ? (
        <FadeInUp delay={delayFor(3)}>
        <BackupNudge
          due={backupDue}
          onBackup={() => exportAllJSON(sessions, lessons, compositions).then(() => setLocalPref('lastBackup', today)).catch(() => {})}
          onLater={() => setLocalPref('backupSnoozedUntil', snoozeUntil(today))}
        />
        </FadeInUp>
      ) : null}

      {/* Feed */}
      {feedItems.length > 0 && (
        <>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
            Previous sessions
          </Text>
          {/* The first few cards fade up one after another; later ones just appear. */}
          {feedItems.map((item, i) => (
            <FadeInUp key={item.id} delay={delayFor(i, 200)} skip={i > 7}>
              {item._type === 'lesson' ? (
                <LessonEntry lesson={item} compositions={compositions}
                  isSelected={isDesktop && rightPanel === 'detail-lesson' && detailLesson?.id === item.id}
                  onPress={() => openLesson(item)} />
              ) : (
                <PracticeEntry session={item} compositions={compositions}
                  isSelected={isDesktop && rightPanel === 'detail-session' && detailSession?.id === item.id}
                  onPress={() => openSession(item)} />
              )}
            </FadeInUp>
          ))}
        </>
      )}

      {sessions.length === 0 && (lessons || []).length === 0 && (
        <View style={{ alignItems: 'center', padding: 32 }}>
          <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.textDim, textAlign: 'center', lineHeight: 24 }}>
            Your practice journal starts here.{'\n'}Log your first session above.
          </Text>
        </View>
      )}
    </>
  );

  // ── Desktop two-column layout ───────────────────────────────────────────────
  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        {/* Glass card — left column only */}
        <View style={{
          position: 'absolute',
          left: 0, right: '50%', top: 12, bottom: 12,
          borderRadius: RADIUS.lg,
          backgroundColor: COLOURS.w(0.28),
          borderWidth: 1,
          borderColor: COLOURS.w(0.55),
          shadowColor: COLOURS.shadow(0.12),
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 24,
          elevation: 2,
        }} />
        {/* Two-column layout on top */}
        <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Left: feed */}
        <View style={{ flex: 1, marginTop: 12, marginBottom: 12, overflow: 'hidden' }}>
          <ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 40, paddingLeft: 226, paddingRight: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.display, color: COLOURS.text }}>Home</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
            </View>
            {feedContent}
          </ScrollView>
          <FAB onPractice={() => openLogSession(today)} onLesson={() => openLogLesson(today)} onTimer={() => setTimerSetupVisible(true)} isDesktop />
        </View>

        {/* Right: detail / inline form panel */}
        <View style={{ flex: 1, minWidth: 0, marginLeft: 12, marginTop: 12, marginBottom: 12, marginRight: 12 }}>
          {rightPanel === 'log-session' && (
            <LogModal
              inline
              initialDate={logModalDate || today}
              initialSession={logModalSession}
              previousSession={latestSession(sessions)}
              compositions={compositions}
              onSave={s => { onSave(s); closeRight(); }}
              onClose={closeRight}
            />
          )}
          {rightPanel === 'log-lesson' && (
            <LessonModal
              inline
              initialDate={lessonModalLesson?.date || lessonModalDate || today}
              initialLesson={lessonModalLesson}
              compositions={compositions}
              onSave={l => { onSaveLesson(l); closeRight(); }}
              onClose={closeRight}
            />
          )}
          {(rightPanel === 'detail-session' || rightPanel === 'detail-lesson') && (
            <ScrollView contentContainerStyle={{ padding: 28, paddingBottom: 48 }}>
              <DesktopDetailPanel
                session={rightPanel === 'detail-session' ? detailSession : null}
                lesson={rightPanel === 'detail-lesson' ? detailLesson : null}
                compositions={compositions}
                onCloseSession={closeRight}
                onCloseLesson={closeRight}
                onDeleteSession={id => { onDelete(id); closeRight(); }}
                onDeleteLesson={id => { onDeleteLesson(id); closeRight(); }}
                onEditSession={s => openLogSession(s.date, s)}
                onEditLesson={l => openLogLesson(l.date, l)}
              />
            </ScrollView>
          )}
          {!rightPanel && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.cardTitle, color: COLOURS.textDim, opacity: 0.5 }}>
                Select an entry to view details
              </Text>
            </View>
          )}
        </View>

        {modals}
        <TimerSetupModal
          visible={timerSetupVisible}
          onClose={() => setTimerSetupVisible(false)}
          onStart={handleTimerStart}
          compositions={compositions}
          previousSession={latestSession(sessions)}
        />
        {timerSegments && (
          <PracticeTimerScreen
            key={sessionKey}
            visible={true}
            initialSegments={timerSegments}
            restore={timerRestore}
            compositions={compositions}
            tempoSuggestions={tempoSuggestions}
            onFinish={handleTimerFinish}
            onSaveComposition={onSaveComposition}
            isDesktop
          />
        )}
        </View>
      </View>
    );
  }

  // ── Mobile single-column layout ─────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        onScroll={onNavScroll}
        scrollEventThrottle={16}
      >
        <TouchableOpacity
          onPress={() => setShowAbout(true)}
          activeOpacity={0.7}
          style={{ marginBottom: 20, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <Image source={require('../../assets/icon.png')} style={{ width: 44, height: 44, borderRadius: RADIUS.sm }} />
          <View>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.screenTitle, color: COLOURS.text, letterSpacing: -0.5 }}>
              music<Text style={{ color: COLOURS.practiceText }}>.</Text><Text style={{ color: COLOURS.lessonText }}>log</Text>
            </Text>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textDim, marginTop: 2 }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
        </TouchableOpacity>
        {feedContent}
      </ScrollView>
      <FAB onPractice={() => openLogSession(today)} onLesson={() => openLogLesson(today)} onTimer={() => setTimerSetupVisible(true)} />
      {modals}
      <Modal visible={showAbout} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAbout(false)}>
        <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
          <TouchableOpacity
            onPress={() => setShowAbout(false)}
            accessibilityRole="button" accessibilityLabel="Close"
            hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
            style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, width: 40, height: 40, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navyA(0.12), alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.body, color: COLOURS.navy }}>✕</Text>
          </TouchableOpacity>
          <AboutScreen isDesktop={false} />
        </View>
      </Modal>
      <TimerSetupModal
        visible={timerSetupVisible}
        onClose={() => setTimerSetupVisible(false)}
        onStart={handleTimerStart}
        compositions={compositions}
        previousSession={latestSession(sessions)}
      />
      {timerSegments && (
        <PracticeTimerScreen
          key={sessionKey}
          visible={true}
          initialSegments={timerSegments}
          restore={timerRestore}
          compositions={compositions}
          tempoSuggestions={tempoSuggestions}
          onFinish={handleTimerFinish}
          onSaveComposition={onSaveComposition}
        />
      )}
    </SafeAreaView>
  );
}
