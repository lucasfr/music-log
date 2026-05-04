import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, RADIUS } from '../theme';
import { SectionTitle, BtnRow, Btn, EmptyState } from '../components/UI';
import { fmtDate } from '../utils';

export default function HistoryScreen({ sessions, compositions, onDelete }) {
  const C = useTheme();
  const [expanded, setExpanded] = useState(null);

  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;

  if (!sessions.length) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.surface }} edges={['top']}>
        <EmptyState icon="📖" text="No sessions logged yet." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.surface }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <SectionTitle>History</SectionTitle>
        {sessions.map(s => {
          const pNames = (s.segments || [])
            .filter(sg => sg.compositionId)
            .map(sg => compName(sg.compositionId))
            .filter(Boolean);
          const freeNames = (s.segments || [])
            .filter(sg => !sg.compositionId && sg.title)
            .map(sg => sg.title);
          const allNames = [...new Set([...pNames, ...freeNames])];
          const techSegs = (s.segments || []).filter(sg => sg.type === 'technique');
          const isOpen = expanded === s.id;

          return (
            <View key={s.id} style={{ borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 14 }}>
              <Text style={{ fontSize: 12, color: C.ink3, marginBottom: 3 }}>{fmtDate(s.date)}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: C.ink, marginBottom: 6, flex: 1 }}>
                  {s.duration ? `${s.duration} min` : 'Session'} · Energy {s.energy > 0 ? `+${s.energy}` : s.energy}
                </Text>
                <TouchableOpacity onPress={() => setExpanded(isOpen ? null : s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 12, color: C.ink3, paddingLeft: 8 }}>{isOpen ? 'less' : 'more'}</Text>
                </TouchableOpacity>
              </View>

              {/* Piece chips */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                {techSegs.map(seg => (
                  <View key={seg.id} style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: C.accent2Light, borderRadius: 10 }}>
                    <Text style={{ fontSize: 11, color: C.accent2 }}>{seg.group || seg.title || 'Technique'}</Text>
                  </View>
                ))}
                {allNames.map(n => (
                  <View key={n} style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: C.accentLight, borderRadius: 10 }}>
                    <Text style={{ fontSize: 11, color: C.accent }}>{n}</Text>
                  </View>
                ))}
              </View>

              {isOpen && (
                <View style={{ marginTop: 12 }}>
                  {(s.segments || []).map(seg => (
                    <View key={seg.id} style={{ marginBottom: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: seg.type === 'technique' ? C.accent2 : C.accent }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: C.ink }}>{seg.title || seg.group || (seg.type === 'technique' ? 'Technique' : 'Repertoire')}</Text>
                      {seg.section ? <Text style={{ fontSize: 12, color: C.ink3 }}>Section: {seg.section}</Text> : null}
                      {seg.notes ? <Text style={{ fontSize: 13, color: C.ink2, marginTop: 3, lineHeight: 19 }}>{seg.notes}</Text> : null}
                    </View>
                  ))}
                  {s.wins ? (
                    <Text style={{ fontSize: 13, color: C.ink2, marginTop: 6 }}>
                      <Text style={{ fontWeight: '600' }}>Wins: </Text>{s.wins}
                    </Text>
                  ) : null}
                  {s.tomorrowFocus ? (
                    <Text style={{ fontSize: 13, color: C.ink2, marginTop: 4 }}>
                      <Text style={{ fontWeight: '600' }}>Next focus: </Text>{s.tomorrowFocus}
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
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
