import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import { COLOURS, RADIUS } from '../theme';
import { AppBackground } from './Background';
import { playChime } from '../utils/chime';
import { useKeepAwake } from '../utils/useKeepAwake';
import { usePracticeTimer } from '../utils/usePracticeTimer';
import { scheduleSegmentEndNotification, cancelScheduledNotification } from '../utils/segmentNotifications';
import { MetronomeControl } from './MetronomeControl';

// Isolated from PracticeTimerScreen for the same reason MetronomeControl is
// memoized against it: the countdown ring's remaining-time display forces
// PracticeTimerScreen to re-render every 250ms (usePracticeTimer's own
// internal UI-refresh tick), and that 250ms cadence doesn't divide evenly
// into most bpm intervals — so periodically a metronome tick's setTimeout
// callback lands right when the parent is also re-rendering and competing
// for the same JS thread, causing exactly the kind of intermittent (not
// immediate) irregularity reported. Memoizing MetronomeControl itself
// stops IT from re-rendering, but the parent's own render pass — walking
// through creating this section's elements — still costs real JS-thread
// time every 250ms unless this section is memoized too, with props that
// stay referentially stable across pure countdown ticks.
const MetronomeSection = React.memo(function MetronomeSection({ showMetronome, onToggle, composition, segmentKey }) {
  return (
    <>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.75}
        style={{
          paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.pill,
          backgroundColor: showMetronome ? COLOURS.navy : 'transparent',
          borderWidth: showMetronome ? 0 : 1, borderColor: 'rgba(9,99,126,0.35)',
          marginBottom: showMetronome ? 14 : 0,
        }}
      >
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: showMetronome ? '#fff' : COLOURS.steel }}>
          Metronome
        </Text>
      </TouchableOpacity>

      {showMetronome && (
        <View style={{ width: '100%', maxWidth: 320 }}>
          <MetronomeControl key={segmentKey} composition={composition} />
        </View>
      )}
    </>
  );
});

const RING_SIZE = 190;
const RING_R = 80;
const RING_STROKE = 11;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

function fmtClock(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtMinutes(ms) {
  const totalMin = Math.round(ms / 60000);
  return `${totalMin}:00`;
}

// Isolated for the same reason as MetronomeSection above, and it's the
// actual root cause that section was defending against: usePracticeTimer
// used to force its caller (this whole screen) to re-render every 250ms
// just to refresh this ring. Now the hook's interval never touches React
// state on its own — this component explicitly opts in via subscribeTick
// and manages its own local re-render, so PracticeTimerScreen itself no
// longer re-renders on a timer at all, only on real events (play/pause/
// skip/segment change).
function CountdownRing({ getRemainingMs, plannedMs, subscribeTick, isRunning }) {
  const [remainingMs, setRemainingMs] = useState(getRemainingMs());

  useEffect(() => {
    setRemainingMs(getRemainingMs());
    if (!isRunning) return;
    return subscribeTick(() => setRemainingMs(getRemainingMs()));
  }, [subscribeTick, getRemainingMs, isRunning, plannedMs]);

  const fractionRemaining = plannedMs > 0 ? Math.max(0, Math.min(1, remainingMs / plannedMs)) : 0;
  const visibleLength = CIRCUMFERENCE * fractionRemaining;

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
          stroke="rgba(9,99,126,0.12)" strokeWidth={RING_STROKE} fill="none"
        />
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
          stroke={COLOURS.amber} strokeWidth={RING_STROKE} fill="none"
          strokeDasharray={`${visibleLength} ${CIRCUMFERENCE}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: 32, color: COLOURS.text }}>{fmtClock(remainingMs)}</Text>
        <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginTop: 2 }}>of {fmtMinutes(plannedMs)}</Text>
      </View>
    </View>
  );
}

export function PracticeTimerScreen({ visible, initialSegments, compositions, onFinish }) {
  const timer = usePracticeTimer(initialSegments);
  useKeepAwake(visible && timer.isRunning);
  const [showMetronome, setShowMetronome] = useState(false);
  const toggleMetronome = useCallback(() => setShowMetronome(s => !s), []);

  // Bumped on every play/pause/skip/+minutes so the notification effect
  // below knows to reschedule against the new deadline — deliberately not
  // tied to timer.remainingMs directly, since that changes every tick.
  const [notifyGen, setNotifyGen] = useState(0);
  const scheduledIdRef = useRef(null);

  function handleStart() { timer.start(); setNotifyGen(g => g + 1); }
  function handlePause() { timer.pause(); setNotifyGen(g => g + 1); }
  function handleSkip() { timer.skip(); setNotifyGen(g => g + 1); }
  function handleAddMinutes(mins) { timer.addMinutes(mins); setNotifyGen(g => g + 1); }

  const prevIndex = useRef(timer.currentIndex);
  useEffect(() => {
    if (timer.currentIndex !== prevIndex.current) {
      playChime();
      prevIndex.current = timer.currentIndex;
    }
  }, [timer.currentIndex]);

  useEffect(() => {
    if (timer.isFinished) {
      playChime();
      onFinish(timer);
    }
  }, [timer.isFinished]);

  useEffect(() => {
    if (visible && !timer.isRunning && !timer.isFinished && timer.segments.length > 0) {
      timer.start();
      setNotifyGen(g => g + 1);
    }
    // Only auto-start once, right when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Reschedule the "segment ending" local notification whenever the
  // deadline changes (play, pause, skip, +minutes). Cancels whatever was
  // previously scheduled first, so a paused/skipped segment never fires
  // a stale notification later.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (scheduledIdRef.current) {
        await cancelScheduledNotification(scheduledIdRef.current);
        scheduledIdRef.current = null;
      }
      if (cancelled) return;
      if (timer.isRunning && timer.currentSegment && timer.remainingMs > 0) {
        const id = await scheduleSegmentEndNotification(timer.currentSegment.title, timer.remainingMs);
        if (!cancelled) scheduledIdRef.current = id;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifyGen]);

  useEffect(() => () => {
    if (scheduledIdRef.current) cancelScheduledNotification(scheduledIdRef.current);
  }, []);

  if (!visible || !timer.currentSegment) return null;

  const linkedComposition = (compositions || []).find(c => c.id === timer.currentSegment.compositionId) || null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => timer.finishNow()}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <AppBackground />
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <BlurView intensity={50} tint="light" style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorderSubtle }}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, backgroundColor: COLOURS.glass }}>
              <TouchableOpacity onPress={() => timer.finishNow()} activeOpacity={0.75}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)' }}>
                <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.textDim, fontSize: 13 }}>Finish</Text>
              </TouchableOpacity>
            </View>
          </BlurView>

          <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 10 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginBottom: 2 }}>
              segment {timer.currentIndex + 1} of {timer.segments.length}
            </Text>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 24, color: COLOURS.text, marginBottom: 8, textAlign: 'center' }}>
              {timer.currentSegment.title || (timer.currentSegment.type === 'technique' ? 'Technical work' : 'Piece')}
              {timer.currentSegment.type === 'technique' && linkedComposition ? ` · ${linkedComposition.title}` : ''}
            </Text>

            <CountdownRing
              getRemainingMs={timer.getRemainingMs}
              plannedMs={timer.plannedMs}
              subscribeTick={timer.subscribeTick}
              isRunning={timer.isRunning}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                onPress={() => (timer.isRunning ? handlePause() : handleStart())}
                activeOpacity={0.85}
                style={{
                  width: 52, height: 52, borderRadius: 26,
                  backgroundColor: COLOURS.navy,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 18, color: '#fff' }}>{timer.isRunning ? '⏸' : '▶'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleAddMinutes(5)}
                activeOpacity={0.85}
                style={{ paddingHorizontal: 18, height: 52, borderRadius: 26, backgroundColor: 'rgba(247,127,0,0.14)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: '#7A3A00' }}>+5 min</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSkip}
                activeOpacity={0.85}
                style={{ paddingHorizontal: 18, height: 52, borderRadius: 26, backgroundColor: 'rgba(140,32,69,0.10)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.practiceText }}>Skip ›</Text>
              </TouchableOpacity>
            </View>

            {timer.nextSegment ? (
              <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 14, marginBottom: 10 }}>
                up next: {timer.nextSegment.title} · {timer.nextSegment.plannedMinutes} min
              </Text>
            ) : (
              <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 14, marginBottom: 10 }}>
                last segment — session ends after this
              </Text>
            )}

            <MetronomeSection
              showMetronome={showMetronome}
              onToggle={toggleMetronome}
              composition={linkedComposition}
              segmentKey={timer.currentIndex}
            />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
