// A mock exam, from the Grade target card: a random pick of the scales and arpeggios the target asks
// for, then your pieces, then sight-reading, one at a time against the clock (see utils/mockExam.js).
// Nothing is saved: it is a run-through, and the summary at the end says what you flagged and which
// item took longest.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, SIZES, HIT_TEXT, HIT_PILL } from '../theme';
import { Tap as TouchableOpacity } from './Motion';
import { buildMockExam, formatElapsed, summariseMockExam } from '../utils/mockExam';
import { parseMockHistory, serializeMockHistory, addMockRun, describeMockProgress } from '../utils/mockExam';
import { usePref } from '../utils/usePref';
import { todayISO } from '../utils';
import { describeRequirement } from '../utils/insights';

const KIND_LABEL = { scale: 'Scale', arpeggio: 'Arpeggio', piece: 'Piece', sight: 'Sight-reading' };

function Button({ label, onPress, primary, a11y }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} hitSlop={HIT_PILL}
      accessibilityRole="button" accessibilityLabel={a11y || label}
      style={{ minHeight: 48, paddingHorizontal: 22, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.pill, backgroundColor: primary ? COLOURS.navy : COLOURS.navyA(0.10) }}>
      <Text style={{ fontFamily: primary ? 'Lato-Bold' : 'Lato', fontSize: SIZES.body, color: primary ? COLOURS.onNavy : COLOURS.textMuted }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function MockExamModal({ visible, readinessResult, onClose }) {
  const [items, setItems] = useState([]);
  const [phase, setPhase] = useState('ready');          // 'ready' | 'running' | 'done'
  const [index, setIndex] = useState(0);
  const [marks, setMarks] = useState({});
  const [seconds, setSeconds] = useState([]);
  // Every finished run is kept, so the next one can say how it compares and Today's plan can pick up what
  // you flagged (see utils/mockExam.js).
  const [historyRaw, setHistoryRaw] = usePref('mockExamHistory', '[]');
  const progressLine = describeMockProgress(parseMockHistory(historyRaw));
  const [now, setNow] = useState(Date.now());
  const examStart = useRef(0);
  const itemStart = useRef(0);

  // A fresh exam each time the screen opens (not each time the card behind it re-renders).
  useEffect(() => {
    if (!visible) return;
    setItems(buildMockExam(readinessResult, Math.random, { describe: describeRequirement }));
    setPhase('ready'); setIndex(0); setMarks({}); setSeconds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // The clock only ticks while an exam is running.
  useEffect(() => {
    if (phase !== 'running') return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const start = () => {
    const t = Date.now();
    examStart.current = t; itemStart.current = t;
    setNow(t); setIndex(0); setMarks({}); setSeconds([]); setPhase('running');
  };
  const next = () => {
    const t = Date.now();
    const taken = Math.round((t - itemStart.current) / 1000);
    const all = [...seconds]; all[index] = taken;
    setSeconds(all);
    itemStart.current = t;
    if (index + 1 >= items.length) {
      setHistoryRaw(serializeMockHistory(addMockRun(parseMockHistory(historyRaw), todayISO(), summariseMockExam(items, marks, all))));
      setPhase('done');
    } else { setIndex(index + 1); setNow(t); }
  };
  const toggleMark = () => setMarks(m => ({ ...m, [index]: !m[index] }));

  const item = items[index];
  const summary = phase === 'done' ? summariseMockExam(items, marks, seconds) : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint={COLOURS.blurTint} style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLOURS.glass }}>
              <Text style={{ flex: 1, fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.sectionTitle, color: COLOURS.text }}>Mock exam</Text>
              <TouchableOpacity onPress={onClose} hitSlop={HIT_TEXT} accessibilityRole="button" accessibilityLabel="Close the mock exam">
                <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.navy, fontSize: SIZES.body }}>{phase === 'running' ? 'Stop' : 'Done'}</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
          {phase === 'ready' ? (
            <View>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.body, color: COLOURS.text, lineHeight: 24 }}>
                {items.length} items, picked at random from your target: scales and arpeggios first, then your pieces, then sight-reading. Take each one as you would in the room, and tap Next when you are done with it.
              </Text>
              <View style={{ marginTop: 16 }}>
                {items.map((x, i) => (
                  <View key={`${x.kind}-${i}`} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6 }}>
                    <Text style={{ width: 96, fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>{KIND_LABEL[x.kind]}</Text>
                    <Text style={{ flex: 1, fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.text }}>{x.label}</Text>
                  </View>
                ))}
              </View>
              <View style={{ marginTop: 20, alignItems: 'flex-start' }}>
                {progressLine ? (
                  <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textDim, marginBottom: 12 }}>{progressLine}</Text>
                ) : null}
                <Button label="Start" primary onPress={start} a11y="Start the mock exam" />
              </View>
            </View>
          ) : null}

          {phase === 'running' && item ? (
            <View accessibilityLiveRegion="polite">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>Item {index + 1} of {items.length}</Text>
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>Total {formatElapsed((now - examStart.current) / 1000)}</Text>
              </View>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 28 }}>{KIND_LABEL[item.kind]}</Text>
              <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.hero, color: COLOURS.text, marginTop: 6, lineHeight: 44 }}>{item.label}</Text>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.display, color: COLOURS.navy, marginTop: 20, fontVariant: ['lining-nums'] }}>{formatElapsed((now - itemStart.current) / 1000)}</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
                <TouchableOpacity onPress={toggleMark} activeOpacity={0.8} hitSlop={HIT_PILL}
                  accessibilityRole="button" accessibilityState={{ selected: !!marks[index] }}
                  accessibilityLabel={marks[index] ? 'Needs work, flagged. Tap to unflag' : 'Flag this item as needing work'}
                  style={{ minHeight: 48, paddingHorizontal: 20, justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: marks[index] ? COLOURS.amber : COLOURS.navyA(0.10) }}>
                  <Text style={{ fontFamily: marks[index] ? 'Lato-Bold' : 'Lato', fontSize: SIZES.body, color: marks[index] ? COLOURS.onAmber : COLOURS.textMuted }}>Needs work</Text>
                </TouchableOpacity>
                <Button label={index + 1 >= items.length ? 'Finish' : 'Next'} primary onPress={next} a11y={index + 1 >= items.length ? 'Finish the mock exam' : 'Next item'} />
              </View>
            </View>
          ) : null}

          {phase === 'done' && summary ? (
            <View>
              <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.sectionTitle, color: COLOURS.text }}>{summary.line}</Text>
              {summary.slowest ? (
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textDim, marginTop: 8 }}>
                  Longest: {summary.slowest.label}, {formatElapsed(summary.slowest.seconds)}.
                </Text>
              ) : null}
              {summary.needsWork.length ? (
                <View style={{ marginTop: 18 }}>
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text, marginBottom: 6 }}>To work on</Text>
                  {summary.needsWork.map((label, i) => (
                    <Text key={`${label}-${i}`} style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.text, paddingVertical: 4 }}>{label}</Text>
                  ))}
                </View>
              ) : null}
              {summary.needsWorkItems.some(x => x.kind !== 'sight') ? (
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 14, lineHeight: 19 }}>
                  The scales, arpeggios and pieces you flagged go into Today's plan on Home for the next two weeks.
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
                <Button label="Another" primary onPress={() => { setItems(buildMockExam(readinessResult, Math.random, { describe: describeRequirement })); setPhase('ready'); }} a11y="Set up another mock exam" />
                <Button label="Close" onPress={onClose} />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
