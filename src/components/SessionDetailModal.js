import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { BtnRow, Btn } from '../components/UI';
import { fmtDate } from '../utils';
import { exportSessionJSON } from '../utils/export';

const ENERGY_LABELS = { '-2': 'Very low', '-1': 'Low', '0': 'Neutral', '1': 'Good', '2': 'High' };

export function SessionDetailModal({ visible, session, compositions, onClose, onDelete }) {
  if (!session) return null;

  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;
  const techSegs = (session.segments || []).filter(s => s.type === 'technique');
  const repSegs  = (session.segments || []).filter(s => s.type === 'repertoire');

  const energyLabel = ENERGY_LABELS[String(session.energy)] || '';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint="light" style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLOURS.glass }}>
              <View>
                <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 19, color: COLOURS.text }}>{fmtDate(session.date)}</Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ fontFamily: 'SourceSans3-Bold', color: COLOURS.navy, fontSize: 16 }}>Done</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

          {/* Summary chips */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.practiceBg, shadowColor: COLOURS.accentMid, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: COLOURS.practiceText }}>🎹 practice</Text>
            </View>
            {session.duration ? (
              <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
                <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: COLOURS.navy }}>⏱ {session.duration} min</Text>
              </View>
            ) : null}
            <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: COLOURS.text }}>
                ⚡ {session.energy > 0 ? `+${session.energy}` : session.energy} · {energyLabel}
              </Text>
            </View>
            {session.enjoyment ? (
              <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
                <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: COLOURS.text }}>❤️ {session.enjoyment}/5</Text>
              </View>
            ) : null}
          </View>

          {/* Technique segments */}
          {techSegs.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>🎹 Technique</Text>
              {techSegs.map(seg => (
                <View key={seg.id} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLOURS.steel, marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 14, color: COLOURS.text }}>{seg.group || seg.title || 'Technical work'}{seg.duration ? ` · ${seg.duration}m` : ''}</Text>
                  {seg.notes ? <Text style={{ fontFamily: 'SourceSans3', fontSize: 13, color: COLOURS.textMuted, marginTop: 4, lineHeight: 20 }}>{seg.notes}</Text> : null}
                  {(seg.challenges || []).length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                      {seg.challenges.map(t => (
                        <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(221,174,211,0.15)', borderRadius: RADIUS.pill }}>
                          <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.textMuted }}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {(seg.progress || []).length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                      {seg.progress.map(t => (
                        <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}>
                          <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.navy }}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Repertoire segments */}
          {repSegs.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>📜 Repertoire</Text>
              {repSegs.map(seg => {
                const name = seg.compositionId ? compName(seg.compositionId) : seg.title;
                return (
                  <View key={seg.id} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLOURS.navy, marginBottom: 12 }}>
                    <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 15, color: COLOURS.text }}>📜 {name || 'Piece'}{seg.duration ? ` · ${seg.duration}m` : ''}</Text>
                    {seg.section ? <Text style={{ fontFamily: 'SourceSans3', fontSize: 12, color: COLOURS.textDim, marginTop: 2 }}>{seg.section}</Text> : null}
                    {seg.notes ? <Text style={{ fontFamily: 'SourceSans3', fontSize: 13, color: COLOURS.textMuted, marginTop: 4, lineHeight: 20 }}>{seg.notes}</Text> : null}
                    {(seg.challenges || []).length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                        {seg.challenges.map(t => (
                          <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(221,174,211,0.15)', borderRadius: RADIUS.pill }}>
                            <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.textMuted }}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {(seg.progress || []).length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                        {seg.progress.map(t => (
                          <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}>
                            <Text style={{ fontFamily: 'SourceSans3', fontSize: 11, color: COLOURS.navy }}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Wins + focus */}
          {session.wins ? (
            <View style={{ marginBottom: 16, padding: 14, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: RADIUS.md, shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>✨ Wins</Text>
              <Text style={{ fontFamily: 'SourceSans3', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{session.wins}</Text>
            </View>
          ) : null}

          {session.tomorrowFocus ? (
            <View style={{ marginBottom: 20, padding: 14, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: RADIUS.md, shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>🎯 Next focus</Text>
              <Text style={{ fontFamily: 'SourceSans3', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{session.tomorrowFocus}</Text>
            </View>
          ) : null}

          <BtnRow>
            <Btn label="Delete" variant="danger" onPress={() =>
              Alert.alert('Delete session?', fmtDate(session.date), [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => { onDelete(session.id); onClose(); } },
              ])
            } />
            <Btn label="Export JSON" onPress={() =>
              exportSessionJSON(session, compositions).catch(e => Alert.alert('Export failed', e.message))
            } />
          </BtnRow>
        </ScrollView>
      </View>
    </Modal>
  );
}
