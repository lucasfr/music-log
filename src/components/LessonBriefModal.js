// The summary for a lesson, on one screen: everything since the last lesson (see lessonBrief in
// utils/insights.js). It shows the same text that Copy / Share sends, so what you read in the lesson
// is exactly what your teacher would get.

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, TOUCH_PILL, HIT_PILL } from '../theme';
import { Btn } from './UI';
import { Tap as TouchableOpacity } from './Motion';
import { briefText } from '../utils/insights';
import { copyText, copiesDirectly } from '../utils/copyText';
import { notify } from '../utils/notify';

// The text is paragraphs separated by blank lines. The first is the title; a paragraph whose first
// line is a heading and whose other lines all start with "- " is a list; anything else is plain.
function toBlocks(text) {
  return text.split('\n\n').map((para, i) => {
    const lines = para.split('\n');
    if (i === 0) return { kind: 'title', lines };
    if (lines.length > 1 && !lines[0].startsWith('- ') && lines.slice(1).every(l => l.startsWith('- '))) {
      return { kind: 'list', heading: lines[0], items: lines.slice(1).map(l => l.slice(2)) };
    }
    return { kind: 'text', lines };
  });
}

export function LessonBriefModal({ visible, brief, onClose }) {
  const text = useMemo(() => (brief ? briefText(brief) : ''), [brief]);
  const blocks = useMemo(() => toBlocks(text), [text]);
  const [done, setDone] = useState(false);
  useEffect(() => { if (!visible) setDone(false); }, [visible]);

  async function handleCopy() {
    const result = await copyText(text);
    if (result === 'failed') notify("Couldn't copy", 'Select the text on screen and copy it from there.');
    else if (result === 'copied') setDone(true);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint={COLOURS.blurTint} style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorderSubtle }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: COLOURS.glass }}>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 22, color: COLOURS.text }}>Lesson summary</Text>
              <TouchableOpacity
                onPress={onClose} activeOpacity={0.75} hitSlop={HIT_PILL}
                accessibilityRole="button" accessibilityLabel="Close"
                style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navyA(0.10) }}
              >
                <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textMuted }}>Done</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
          {blocks.map((b, i) => {
            if (b.kind === 'title') {
              return <Text key={i} selectable style={{ fontFamily: 'CormorantGaramond', fontSize: 22, color: COLOURS.text, lineHeight: 28, marginBottom: 14 }}>{b.lines.join('\n')}</Text>;
            }
            if (b.kind === 'list') {
              return (
                <View key={i} style={{ marginBottom: 16 }}>
                  <Text accessibilityRole="header" style={{ fontFamily: 'Lato-Bold', fontSize: 15, color: COLOURS.text, marginBottom: 6 }}>{b.heading}</Text>
                  {b.items.map((item, j) => (
                    <View key={j} style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: COLOURS.steel, marginTop: 8 }} />
                      <Text selectable style={{ flex: 1, fontFamily: 'Lato', fontSize: 15, color: COLOURS.text, lineHeight: 22 }}>{item}</Text>
                    </View>
                  ))}
                </View>
              );
            }
            return <Text key={i} selectable style={{ fontFamily: 'Lato', fontSize: 15, color: COLOURS.text, lineHeight: 22, marginBottom: 16 }}>{b.lines.join('\n')}</Text>;
          })}

          <Btn
            label={done ? 'Copied' : copiesDirectly ? 'Copy summary' : 'Share summary'}
            variant="primary"
            onPress={handleCopy}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
