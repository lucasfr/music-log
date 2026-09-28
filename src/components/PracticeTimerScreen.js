import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { COLOURS, RADIUS } from '../theme';
import { playChime } from '../utils/chime';
import { useKeepAwake } from '../utils/useKeepAwake';
import { usePracticeTimer } from '../utils/usePracticeTimer';
import { scheduleSegmentEndNotification, cancelScheduledNotification } from '../utils/segmentNotifications';

const RING_SIZE = 220;
const RING_R = 92;
const RING_STROKE = 12;
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

export function PracticeTimerScreen({ visible, initialSegments, onCancel, onFinish }) {
  const timer = usePracticeTimer(initialSegments);
  useKeepAwake(visible && timer.isRunning);

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

  const fractionRemaining = timer.plannedMs > 0 ? Math.max(0, Math.min(1, timer.remainingMs / timer.plannedMs)) : 0;
  const visibleLength = CIRCUMFERENCE * fractionRemaining;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 8 }}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.75}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)' }}>
              <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.textDim, fontSize: 13 }}>End session</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginBottom: 4 }}>
              segment {timer.currentIndex + 1} of {timer.segments.length}
            </Text>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 24, color: COLOURS.text, marginBottom: 24, textAlign: 'center' }}>
              {timer.currentSegment.title || (timer.currentSegment.type === 'technique' ? 'Technical work' : 'Piece')}
            </Text>

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
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 36, color: COLOURS.text }}>{fmtClock(timer.remainingMs)}</Text>
                <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginTop: 2 }}>of {fmtMinutes(timer.plannedMs)}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 32 }}>
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
              <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 22 }}>
                up next: {timer.nextSegment.title} · {timer.nextSegment.plannedMinutes} min
              </Text>
            ) : (
              <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 22 }}>
                last segment — session ends after this
              </Text>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
