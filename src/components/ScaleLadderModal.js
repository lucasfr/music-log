// The scale ladder, from the Grade target card: a short routine of the scales and arpeggios your target
// asks for, each with the metronome. Tap Clean when you play one cleanly and the tempo steps up; tap Not yet
// and it steps down. The clean tempo is kept per scale and shown next time (see utils/scaleLadder.js).

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, SIZES, HIT_TEXT, HIT_PILL } from '../theme';
import { Tap as TouchableOpacity } from './Motion';
import { MetronomeControl } from './MetronomeControl';
import { usePref } from '../utils/usePref';
import { todayISO } from '../utils';
import { describeRequirement } from '../utils/insights';
import {
  parseScaleTempos, serializeScaleTempos, recordClean, startTempoFor, stepTempo, pickLadder, describeLadder, cleanTempoFor,
} from '../utils/scaleLadder';

function Button({ label, onPress, primary, a11y }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} hitSlop={HIT_PILL}
      accessibilityRole="button" accessibilityLabel={a11y || label}
      style={{ minHeight: 48, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.pill, backgroundColor: primary ? COLOURS.navy : COLOURS.navyA(0.10) }}>
      <Text style={{ fontFamily: primary ? 'Lato-Bold' : 'Lato', fontSize: SIZES.body, color: primary ? COLOURS.onNavy : COLOURS.textMuted }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ScaleLadderModal({ visible, readinessResult, onClose }) {
  const [raw, setRaw] = usePref('scaleTempos', '{}');
  const map = useMemo(() => parseScaleTempos(raw), [raw]);
  const [routine, setRoutine] = useState([]);
  const [phase, setPhase] = useState('ready');      // 'ready' | 'running' | 'done'
  const [index, setIndex] = useState(0);
  const [bpm, setBpm] = useState(60);
  const [cleanThisRun, setCleanThisRun] = useState({});   // index -> the clean tempo reached in this run

  // A fresh routine each time the screen opens (not each time the card behind it re-renders).
  useEffect(() => {
    if (!visible) return;
    const reqs = [...((readinessResult && readinessResult.scales) || []), ...((readinessResult && readinessResult.arpeggios) || [])];
    setRoutine(pickLadder(reqs, map));
    setPhase('ready'); setIndex(0); setCleanThisRun({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const item = routine[index];
  const begin = i => { setIndex(i); setBpm(startTempoFor(map, routine[i])); };
  const start = () => { setCleanThisRun({}); begin(0); setPhase('running'); };
  const clean = () => {
    setRaw(serializeScaleTempos(recordClean(map, item, bpm, todayISO())));
    setCleanThisRun(c => ({ ...c, [index]: bpm }));
    setBpm(stepTempo(bpm, true));
  };
  const notYet = () => setBpm(stepTempo(bpm, false));
  const next = () => {
    if (index + 1 >= routine.length) { setPhase('done'); return; }
    begin(index + 1);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint={COLOURS.blurTint} style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLOURS.glass }}>
              <Text style={{ flex: 1, fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.sectionTitle, color: COLOURS.text }}>Scale ladder</Text>
              <TouchableOpacity onPress={onClose} hitSlop={HIT_TEXT} accessibilityRole="button" accessibilityLabel="Close the scale ladder">
                <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.navy, fontSize: SIZES.body }}>{phase === 'running' ? 'Stop' : 'Done'}</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          {routine.length === 0 ? (
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.body, color: COLOURS.text, lineHeight: 24 }}>
              Add the scales and arpeggios your target asks for (Edit on the Grade target card) and the ladder will take you through them one at a time.
            </Text>
          ) : null}

          {routine.length > 0 && phase === 'ready' ? (
            <View>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.body, color: COLOURS.text, lineHeight: 24 }}>
                {routine.length} {routine.length === 1 ? 'scale' : 'scales'} from your target, the ones with no clean tempo yet first. Each starts gently; tap Clean when you play it cleanly and the tempo steps up, Not yet to step down.
              </Text>
              <View style={{ marginTop: 16 }}>
                {routine.map((q, i) => (
                  <View key={`${describeRequirement(q)}-${i}`} style={{ paddingVertical: 6 }}>
                    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.text }}>{describeRequirement(q)}</Text>
                    <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginTop: 1 }}>{describeLadder(map, q)}</Text>
                  </View>
                ))}
              </View>
              <View style={{ marginTop: 20, alignItems: 'flex-start' }}>
                <Button label="Start" primary onPress={start} a11y="Start the scale ladder" />
              </View>
            </View>
          ) : null}

          {phase === 'running' && item ? (
            <View>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>Scale {index + 1} of {routine.length}</Text>
              <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.hero, color: COLOURS.text, marginTop: 6, lineHeight: 44 }}>{describeRequirement(item)}</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 2 }}>{describeLadder(map, item)}</Text>
              <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.display, color: COLOURS.navy, fontVariant: ['lining-nums'] }}>{bpm}</Text>
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>bpm</Text>
                {cleanThisRun[index] ? <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.success, marginLeft: 8 }}>Clean at {cleanThisRun[index]}</Text> : null}
              </View>
              {/* A new metronome for each tempo, so it opens at the tempo the ladder has reached (press play again). */}
              <View style={{ marginTop: 14 }}>
                <MetronomeControl key={`${index}-${bpm}`} compact composition={{ title: describeRequirement(item), tempo: bpm, timeSigs: ['4/4'] }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                <Button label="Clean" primary onPress={clean} a11y={`Played ${describeRequirement(item)} cleanly at ${bpm}. Step the tempo up`} />
                <Button label="Not yet" onPress={notYet} a11y={`Not clean yet at ${bpm}. Step the tempo down`} />
                <Button label={index + 1 >= routine.length ? 'Finish' : 'Next scale'} onPress={next} />
              </View>
            </View>
          ) : null}

          {phase === 'done' ? (
            <View>
              <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.sectionTitle, color: COLOURS.text }}>
                {Object.keys(cleanThisRun).length} of {routine.length} played cleanly
              </Text>
              <View style={{ marginTop: 14 }}>
                {routine.map((q, i) => (
                  <View key={`${describeRequirement(q)}-${i}`} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6 }}>
                    <Text style={{ flex: 1, fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.text }}>{describeRequirement(q)}</Text>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: cleanThisRun[i] ? COLOURS.success : COLOURS.textDim }}>
                      {cleanThisRun[i] ? `${cleanThisRun[i]} bpm` : cleanTempoFor(map, q) ? `${cleanTempoFor(map, q)} bpm before` : 'not yet'}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
                <Button label="Another round" primary onPress={() => { setRoutine(pickLadder([...((readinessResult && readinessResult.scales) || []), ...((readinessResult && readinessResult.arpeggios) || [])], map)); setPhase('ready'); }} a11y="Set up another round" />
                <Button label="Close" onPress={onClose} />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
