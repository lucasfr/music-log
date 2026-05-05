import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { BtnRow, Btn } from '../components/UI';
import { fmtDate } from '../utils';
import { exportSessionJSON } from '../utils/export';

export function LessonDetailModal({ visible, lesson, compositions, onClose, onDelete }) {
  if (!lesson) return null;

  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <BlurView intensity={50} tint="light" style={{ borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLOURS.glass }}>
              <View>
                <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 19, color: COLOURS.text }}>{fmtDate(lesson.date)}</Text>
                <Text style={{ fontFamily: 'SourceSans3', fontSize: 12, color: COLOURS.textDim, marginTop: 1 }}>
                  Lesson · {lesson.duration} min · {lesson.teacher}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ fontFamily: 'SourceSans3-Bold', color: COLOURS.navy, fontSize: 16 }}>Done</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.accent2Light }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: '#7A3A00' }}>🎓 lesson</Text>
            </View>
            <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.glass }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 13, color: COLOURS.navy }}>{lesson.duration} min</Text>
            </View>
            {lesson.energy ? (
              <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)' }}>
                <Text style={{ fontSize: 16 }}>
                  {[...Array(5)].map((_, i) => i < (lesson.energy + 3) ? '⚡' : '').join('')}
                </Text>
              </View>
            ) : null}
            {lesson.enjoyment ? (
              <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)' }}>
                <Text style={{ fontSize: 16 }}>
                  {[...Array(5)].map((_, i) => i < lesson.enjoyment ? '❤️' : '').join('')}
                </Text>
              </View>
            ) : null}
          </View>

          {(lesson.pieces || []).length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
                Pieces
              </Text>
              {lesson.pieces.map((item, i) => {
                const name = item.compositionId ? compName(item.compositionId) : item.pieceName;
                return (
                  <View key={item.id || i} style={{
                    marginBottom: 12, padding: 14,
                    backgroundColor: 'rgba(255,255,255,0.55)',
                    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLOURS.glassBorder,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: item.feedback ? 10 : 0 }}>
                      <Text style={{ fontFamily: 'LibreBaskerville-Italic', fontSize: 16, color: COLOURS.text, flex: 1 }}>{name || 'Piece'}</Text>
                      {item.isNew && (
                        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.pinkLight }}>
                          <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 10, color: '#5C2D6E' }}>new</Text>
                        </View>
                      )}
                    </View>
                    {item.feedback ? (
                      <View style={{ paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: COLOURS.steel, marginBottom: item.assignment ? 10 : 0 }}>
                        <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Feedback</Text>
                        <Text style={{ fontFamily: 'SourceSans3', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{item.feedback}</Text>
                      </View>
                    ) : null}
                    {item.assignment ? (
                      <View style={{ paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: COLOURS.navy, marginTop: item.feedback ? 10 : 0 }}>
                        <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Assignment</Text>
                        <Text style={{ fontFamily: 'SourceSans3', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{item.assignment}</Text>
                      </View>
                    ) : null}
                    {(item.feltDifficulty || item.liking) ? (
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                        {item.feltDifficulty ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            {[...Array(5)].map((_, i) => (
                              <Text key={i} style={{ fontSize: 14, opacity: i < item.feltDifficulty ? 1 : 0.18 }}>🎵</Text>
                            ))}
                          </View>
                        ) : null}
                        {item.liking ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            {[...Array(5)].map((_, i) => (
                              <Text key={i} style={{ fontSize: 14, opacity: i < item.liking ? 1 : 0.18 }}>⭐</Text>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}

          {lesson.overallNotes ? (
            <View style={{ marginBottom: 14, padding: 14, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLOURS.glassBorder }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Overall notes</Text>
              <Text style={{ fontFamily: 'SourceSans3', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{lesson.overallNotes}</Text>
            </View>
          ) : null}

          {lesson.wins ? (
            <View style={{ marginBottom: 14, padding: 14, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLOURS.glassBorder }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Wins</Text>
              <Text style={{ fontFamily: 'SourceSans3', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{lesson.wins}</Text>
            </View>
          ) : null}

          {lesson.nextFocus ? (
            <View style={{ marginBottom: 20, padding: 14, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLOURS.glassBorder }}>
              <Text style={{ fontFamily: 'SourceSans3-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Focus before next lesson</Text>
              <Text style={{ fontFamily: 'SourceSans3', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{lesson.nextFocus}</Text>
            </View>
          ) : null}

          <BtnRow>
            <Btn label="Delete" variant="danger" onPress={() =>
              Alert.alert('Delete lesson?', fmtDate(lesson.date), [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => { onDelete(lesson.id); onClose(); } },
              ])
            } />
            <Btn label="Export JSON" onPress={() =>
              exportSessionJSON(lesson, compositions).catch(e => Alert.alert('Export failed', e.message))
            } />
          </BtnRow>
        </ScrollView>
      </View>
    </Modal>
  );
}
