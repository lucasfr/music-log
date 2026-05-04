import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { SectionTitle, BtnRow, Btn, EmptyState } from '../components/UI';
import { fmtDate } from '../utils';

export default function HistoryScreen({ sessions, compositions, onDelete }) {
  const [expanded, setExpanded] = useState(null);
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;

  if (!sessions.length) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <EmptyState icon="📖" text="No sessions logged yet." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <SectionTitle style={{ marginTop: 4 }}>History</SectionTitle>
        {sessions.map(s => {
          const pNames = (s.segments || [])
            .filter(sg => sg.compositionId)
            .map(sg => compName(sg.compositionId)).filter(Boolean);
          const freeNames = (s.segments || [])
            .filter(sg => !sg.compositionId && sg.title).map(sg => sg.title);
          const allNames = [...new Set([...pNames, ...freeNames])];
          const techSegs = (s.segments || []).filter(sg => sg.type === 'technique');
          const isOpen = expanded === s.id;

          return (
            <BlurView
              key={s.id}
              intensity={28}
              tint="light"
              style={{
                borderRadius: RADIUS.md,
                borderWidth: 1,
                borderColor: COLOURS.glassBorder,
                overflow: 'hidden',
                marginBottom: 10,
                shadowColor: COLOURS.glassShadow,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 1,
                shadowRadius: 10,
                elevation: 3,
              }}
            >
              <View style={{ backgroundColor: COLOURS.glass }}>
                <View style={{ padding: 14 }}>
                  <Text style={{ fontFamily: 'SourceSans3', fontSize: 12, color: COLOURS.textDim, marginBottom: 3 }}>{fmtDate(s.date)}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 14, color: COLOURS.text, marginBottom: 8, flex: 1 }}>
                      {s.duration ? `${s.duration} min` : 'Session'} · Energy {s.energy > 0 ? `+${s.energy}` : s.energy}
                    </Text>
                    <TouchableOpacity onPress={() => setExpanded(isOpen ? null : s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ fontFamily: 'SourceSans3', fontSize: 12, color: COLOURS.textDim, paddingLeft: 10 }}>{isOpen ? 'less' : 'more'}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                    {techSegs.map(seg => (
                      <View key={seg.id} style={{ paddingHorizontal: 9, paddingVertical: 3, backgroundColor: COLOURS.accent2Light, borderRadius: RADIUS.pill }}>
                        <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.navy }}>{seg.group || seg.title || 'Technique'}</Text>
                      </View>
                    ))}
                    {allNames.map(n => (
                      <View key={n} style={{ paddingHorizontal: 9, paddingVertical: 3, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}>
                        <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.navy }}>{n}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {isOpen && (
                  <View style={{ borderTopWidth: 1, borderTopColor: COLOURS.glassBorder, padding: 14, backgroundColor: 'rgba(255,255,255,0.30)' }}>
                    {(s.segments || []).map(seg => (
                      <View key={seg.id} style={{ marginBottom: 10, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: seg.type === 'technique' ? COLOURS.steel : COLOURS.navy }}>
                        <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: COLOURS.text }}>{seg.title || seg.group || (seg.type === 'technique' ? 'Technique' : 'Repertoire')}</Text>
                        {seg.section ? <Text style={{ fontFamily: 'SourceSans3', fontSize: 12, color: COLOURS.textDim }}>Section: {seg.section}</Text> : null}
                        {seg.notes  ? <Text style={{ fontFamily: 'SourceSans3', fontSize: 13, color: COLOURS.textMuted, marginTop: 3, lineHeight: 19 }}>{seg.notes}</Text> : null}
                      </View>
                    ))}
                    {s.wins ? (
                      <Text style={{ fontFamily: 'SourceSans3', fontSize: 13, color: COLOURS.textMuted, marginTop: 6 }}>
                        <Text style={{ fontFamily: 'SourceSans3-Bold' }}>Wins: </Text>{s.wins}
                      </Text>
                    ) : null}
                    {s.tomorrowFocus ? (
                      <Text style={{ fontFamily: 'SourceSans3', fontSize: 13, color: COLOURS.textMuted, marginTop: 4 }}>
                        <Text style={{ fontFamily: 'SourceSans3-Bold' }}>Next focus: </Text>{s.tomorrowFocus}
                      </Text>
                    ) : null}
                    <BtnRow style={{ marginTop: 10 }}>
                      <Btn label="Delete session" variant="danger" onPress={() =>
                        Alert.alert('Delete session?', fmtDate(s.date), [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => onDelete(s.id) },
                        ])
                      } />
                    </BtnRow>
                  </View>
                )}
              </View>
            </BlurView>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
