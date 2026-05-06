import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, SIZES } from '../theme';
import { BtnRow, Btn } from '../components/UI';
import { fmtDate } from '../utils';
import { exportSessionJSON } from '../utils/export';

const ENERGY_LABELS = { '-2': 'Very low', '-1': 'Low', '0': 'Neutral', '1': 'Good', '2': 'High' };

// energy DB value -2..+2 → bar 1..5
function energyToBar(v) { return (v ?? 0) + 3; }

function ZeldaMini({ emoji, value, total = 5 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <Text key={i} style={{ fontSize: 20, opacity: i < value ? 1 : 0.18, transform: [{ scale: i < value ? 1 : 0.88 }] }}>
          {emoji}
        </Text>
      ))}
    </View>
  );
}

function StarRow({ value, total = 5, emoji = '🎵' }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center', marginTop: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <Text key={i} style={{ fontSize: 14, opacity: i < value ? 1 : 0.18 }}>{emoji}</Text>
      ))}
    </View>
  );
}

export function SessionDetailModal({ visible, session, compositions, onClose, onDelete, onEdit }) {
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
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 19, color: COLOURS.text }}>{fmtDate(session.date)}</Text>
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                {onEdit && (
                  <TouchableOpacity onPress={() => { onClose(); onEdit(session); }}>
                    <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.steel, fontSize: 16 }}>Edit</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose}>
                  <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.navy, fontSize: 16 }}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

          {/* Summary chips */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.practiceBg, shadowColor: COLOURS.accentMid, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.practiceText }}>🎹 practice</Text>
            </View>
            {session.duration ? (
              <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>⏱ {session.duration} min</Text>
              </View>
            ) : null}
          </View>

          {/* Zelda bars for energy + enjoyment */}
          <View style={{ flexDirection: 'row', gap: 24, marginBottom: 20 }}>
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                ⚡ Energy · {session.energy > 0 ? `+${session.energy}` : session.energy} {energyLabel}
              </Text>
              <ZeldaMini emoji="⚡" value={energyToBar(session.energy)} />
            </View>
            {session.enjoyment ? (
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  ❤️ Enjoyment
                </Text>
                <ZeldaMini emoji="❤️" value={session.enjoyment} />
              </View>
            ) : null}
          </View>

          {/* Technique segments */}
          {techSegs.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>🎹 Technique</Text>
              {techSegs.map(seg => (
                <View key={seg.id} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLOURS.steel, marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text }}>{seg.group || seg.title || 'Technical work'}</Text>
                    {seg.duration ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)' }}>
                        <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>⏱ {seg.duration} min</Text>
                      </View>
                    ) : null}
                  </View>
                  {seg.scales?.length > 0 && (
                    <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textMuted, marginTop: 3 }}>{seg.scales.join(' · ')}</Text>
                  )}
                  {seg.notes ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, marginTop: 4, lineHeight: 20 }}>{seg.notes}</Text> : null}
                  {(seg.challenges || []).length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                      {seg.challenges.map(t => (
                        <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(221,174,211,0.15)', borderRadius: RADIUS.pill }}>
                          <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textMuted }}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {(seg.progress || []).length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                      {seg.progress.map(t => (
                        <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}>
                          <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.navy }}>{t}</Text>
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
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>📜 Repertoire</Text>
              {repSegs.map(seg => {
                const name = seg.compositionId ? compName(seg.compositionId) : seg.title;
                return (
                  <View key={seg.id} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLOURS.navy, marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 16, color: COLOURS.text }}>📜 {name || 'Piece'}</Text>
                      {seg.duration ? (
                        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)' }}>
                          <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>⏱ {seg.duration} min</Text>
                        </View>
                      ) : null}
                    </View>
                    {seg.section ? <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 2 }}>{seg.section}</Text> : null}
                    {seg.feltDifficulty ? (
                      <View style={{ marginTop: 4 }}>
                        <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim, marginBottom: 2 }}>Felt difficulty</Text>
                        <StarRow value={seg.feltDifficulty} emoji="🎵" />
                      </View>
                    ) : null}
                    {seg.notes ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, marginTop: 6, lineHeight: 20 }}>{seg.notes}</Text> : null}
                    {(seg.challenges || []).length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                        {seg.challenges.map(t => (
                          <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(221,174,211,0.15)', borderRadius: RADIUS.pill }}>
                            <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textMuted }}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {(seg.progress || []).length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                        {seg.progress.map(t => (
                          <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}>
                            <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.navy }}>{t}</Text>
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
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>✨ Wins</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{session.wins}</Text>
            </View>
          ) : null}

          {session.tomorrowFocus ? (
            <View style={{ marginBottom: 20, padding: 14, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: RADIUS.md, shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>🎯 Next focus</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{session.tomorrowFocus}</Text>
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
