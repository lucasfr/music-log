import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Platform, Image, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, SIZES } from '../theme';
import { LogModal } from '../components/LogModal';
import { LessonModal } from '../components/LessonModal';
import { SessionDetailModal } from '../components/SessionDetailModal';
import { LessonDetailModal } from '../components/LessonDetailModal';
import { fmtDate, confirmDelete } from '../utils';
import { exportSessionJSON, exportAllJSON } from '../utils/export';
import AboutScreen from './AboutScreen';

function energyToBar(v) { return v === null || v === undefined ? 0 : v + 3; }

const ENERGY_LABELS = { '-2': 'Very low', '-1': 'Low', '0': 'Neutral', '1': 'Good', '2': 'High' };

function ZeldaMini({ emoji, value, total = 5, size = 16 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <Text key={i} style={{ fontSize: size, opacity: i < value ? 1 : 0.18, transform: [{ scale: i < value ? 1 : 0.88 }] }}>{emoji}</Text>
      ))}
    </View>
  );
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Practice entry card ──────────────────────────────────────────────────────

function PracticeEntry({ session, compositions, onPress, showDate = true, isSelected = false }) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;
  const techSegs  = (session.segments || []).filter(s => s.type === 'technique');
  const repSegs   = (session.segments || []).filter(s => s.type === 'repertoire');
  const techNames  = [...new Set(techSegs.map(s => s.group || s.title).filter(Boolean))];
  const pieceNames = [...new Set(repSegs.map(s => s.compositionId ? compName(s.compositionId) : s.title).filter(Boolean))];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <BlurView intensity={isSelected ? 50 : 36} tint="light" style={{
        borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 10,
        shadowColor: isSelected ? COLOURS.navy : COLOURS.glassShadow,
        shadowOffset: { width: 0, height: isSelected ? 8 : 5 },
        shadowOpacity: isSelected ? 0.18 : 1,
        shadowRadius: isSelected ? 24 : 18,
        elevation: isSelected ? 8 : 5,
      }}>
        <View style={{ backgroundColor: COLOURS.accentLight, padding: 14, flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>
          <View style={{ width: 4, borderRadius: 2, backgroundColor: COLOURS.red, alignSelf: 'stretch' }} />
          <View style={{ flex: 1 }}>
            {showDate && (
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text, marginBottom: 4 }}>
                {fmtDate(session.date)}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: COLOURS.practiceBg }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny + 1, color: COLOURS.practiceText }}>🎹 practice</Text>
              </View>
              {session.duration ? (
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>{session.duration} min</Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <ZeldaMini emoji="⚡" value={energyToBar(session.energy)} />
              {session.enjoyment ? <ZeldaMini emoji="❤️" value={session.enjoyment} /> : null}
            </View>
            {(techNames.length > 0 || pieceNames.length > 0) && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                {techNames.map(t => (
                  <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.practiceBg, borderRadius: RADIUS.pill }}>
                    <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.practiceText }}>{t}</Text>
                  </View>
                ))}
                {pieceNames.map(p => (
                  <View key={p} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.practiceBg, borderRadius: RADIUS.pill }}>
                    <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.practiceText }}>{p}</Text>
                  </View>
                ))}
              </View>
            )}
            {session.wins ? (
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 13, color: COLOURS.textMuted, marginTop: 8, lineHeight: 19 }} numberOfLines={2}>
                "{session.wins}"
              </Text>
            ) : null}
          </View>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

// ─── Lesson entry card ────────────────────────────────────────────────────────

function LessonEntry({ lesson, compositions, onPress, showDate = true, isSelected = false }) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;
  const pieceNames = [...new Set((lesson.pieces || []).map(p =>
    p.compositionId ? compName(p.compositionId) : p.pieceName
  ).filter(Boolean))];
  const newPieces = (lesson.pieces || []).filter(p => p.isNew);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <BlurView intensity={isSelected ? 50 : 36} tint="light" style={{
        borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 10,
        shadowColor: isSelected ? COLOURS.navy : COLOURS.glassShadow,
        shadowOffset: { width: 0, height: isSelected ? 8 : 5 },
        shadowOpacity: isSelected ? 0.18 : 1,
        shadowRadius: isSelected ? 24 : 18,
        elevation: isSelected ? 8 : 5,
      }}>
        <View style={{ backgroundColor: COLOURS.accent2Light, padding: 14, flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>
          <View style={{ width: 4, borderRadius: 2, backgroundColor: COLOURS.amber, alignSelf: 'stretch' }} />
          <View style={{ flex: 1 }}>
            {showDate && (
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text, marginBottom: 4 }}>
                {fmtDate(lesson.date)}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: COLOURS.lessonBg }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny + 1, color: COLOURS.lessonText }}>🎓 lesson</Text>
              </View>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>{lesson.duration} min · {lesson.teacher}</Text>
            </View>
            {(lesson.energy || lesson.enjoyment) ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                {lesson.energy ? <ZeldaMini emoji="⚡" value={energyToBar(lesson.energy)} /> : null}
                {lesson.enjoyment ? <ZeldaMini emoji="❤️" value={lesson.enjoyment} /> : null}
              </View>
            ) : null}
            {pieceNames.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                {pieceNames.map(p => (
                  <View key={p} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLOURS.lessonBg, borderRadius: RADIUS.pill }}>
                    <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.lessonText }}>{p}</Text>
                  </View>
                ))}
                {newPieces.map(p => {
                  const name = p.compositionId ? compName(p.compositionId) : p.pieceName;
                  return name ? (
                    <View key={p.id} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(252,191,73,0.18)', borderRadius: RADIUS.pill }}>
                      <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: '#5A3A00' }}>✦ {name}</Text>
                    </View>
                  ) : null;
                })}
              </View>
            )}
            {lesson.wins ? (
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 13, color: COLOURS.textMuted, marginTop: 8, lineHeight: 19 }} numberOfLines={2}>
                "{lesson.wins}"
              </Text>
            ) : null}
          </View>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

// ─── FAB ─────────────────────────────────────────────────────────────────────

function FAB({ onPractice, onLesson }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ position: 'absolute', bottom: Platform.OS === 'web' ? 24 : Platform.OS === 'ios' ? 140 : 120, right: 20, alignItems: 'flex-end', gap: 10 }}>
      {expanded && (
        <>
          <TouchableOpacity onPress={() => { setExpanded(false); onLesson(); }} activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.50)', shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 4 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.lessonText }}>🎓 Log lesson</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setExpanded(false); onPractice(); }} activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.50)', shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 4 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.practiceText }}>🎹 Log practice</Text>
          </TouchableOpacity>
        </>
      )}
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.85}
        style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.58)', alignItems: 'center', justifyContent: 'center', shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8 }}>
        <Text style={{ fontSize: expanded ? 22 : 28, color: COLOURS.text, lineHeight: 32, marginTop: -2 }}>
          {expanded ? '✕' : '+'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Shared glass helpers ────────────────────────────────────────────────────

const glass = {
  card: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: 'rgba(9,99,126,0.08)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  inner: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    padding: 14,
  },
};

function GlassBtn({ label, onPress, color, danger, small }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={{
      paddingHorizontal: small ? 10 : 16, paddingVertical: 8,
      alignSelf: small ? 'flex-start' : 'auto',
      borderRadius: RADIUS.pill,
      backgroundColor: danger ? 'rgba(214,40,40,0.07)' : 'rgba(255,255,255,0.55)',
      shadowColor: danger ? 'rgba(214,40,40,0.10)' : 'rgba(9,99,126,0.08)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1, shadowRadius: 6, elevation: 2,
    }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: small ? 11 : 13, color: color || COLOURS.navy }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Desktop detail panel ─────────────────────────────────────────────────────

function DesktopDetailPanel({ session, lesson, compositions, onCloseSession, onCloseLesson, onDeleteSession, onDeleteLesson, onEditSession }) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;

  if (session) {
    const techSegs = (session.segments || []).filter(s => s.type === 'technique');
    const repSegs  = (session.segments || []).filter(s => s.type === 'repertoire');
    const energyLabel = ENERGY_LABELS[String(session.energy)] || '';
    return (
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 26, color: COLOURS.text }}>{fmtDate(session.date)}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {onEditSession && <GlassBtn label="Edit" onPress={() => onEditSession(session)} color={COLOURS.steel} />}
            <GlassBtn label="✕" onPress={onCloseSession} color={COLOURS.textDim} />
          </View>
        </View>

        {/* Summary chips */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: COLOURS.practiceBg, shadowColor: COLOURS.accentMid, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.practiceText }}>🎹 practice</Text>
          </View>
          {session.duration ? (
            <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.65)', shadowColor: 'rgba(9,99,126,0.10)', shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>⏱ {session.duration} min</Text>
            </View>
          ) : null}
        </View>

        {/* Energy + enjoyment glass card */}
        <BlurView intensity={40} tint="light" style={glass.card}>
          <View style={glass.inner}>
            <View style={{ flexDirection: 'row', gap: 28 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>⚡ Energy · {session.energy > 0 ? `+${session.energy}` : session.energy} {energyLabel}</Text>
                <ZeldaMini emoji="⚡" value={energyToBar(session.energy)} size={22} />
              </View>
              {session.enjoyment ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>❤️ Enjoyment</Text>
                  <ZeldaMini emoji="❤️" value={session.enjoyment} size={22} />
                </View>
              ) : null}
            </View>
          </View>
        </BlurView>

        {/* Technique segments */}
        {techSegs.length > 0 && (
          <BlurView intensity={40} tint="light" style={glass.card}>
            <View style={[glass.inner, { paddingBottom: 8 }]}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>🎹 Technique</Text>
              {techSegs.map(seg => (
                <View key={seg.id} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLOURS.steel, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text }}>
                      {compName(seg.compositionId) || seg.group || seg.title || 'Technical work'}
                    </Text>
                    {seg.compositionId && (seg.group || seg.title) ? (
                      <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.accent2Light }}>
                        <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.steel }}>{seg.group || seg.title}</Text>
                      </View>
                    ) : null}
                    {seg.duration ? <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.7)' }}><Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>⏱ {seg.duration}m</Text></View> : null}
                  </View>
                  {seg.scales?.length > 0 && <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textMuted, marginTop: 2 }}>{seg.scales.join(' · ')}{seg.octaves ? ` · ${seg.octaves} oct` : ''}</Text>}
                  {seg.notes ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, marginTop: 4, lineHeight: 20 }}>{seg.notes}</Text> : null}
                  {((seg.challenges||[]).length > 0 || (seg.progress||[]).length > 0) && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                      {(seg.challenges||[]).map(t => <View key={t} style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: 'rgba(221,174,211,0.15)', borderRadius: RADIUS.pill }}><Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textMuted }}>{t}</Text></View>)}
                      {(seg.progress||[]).map(t => <View key={t} style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}><Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.navy }}>{t}</Text></View>)}
                    </View>
                  )}
                </View>
              ))}
            </View>
          </BlurView>
        )}

        {/* Repertoire segments */}
        {repSegs.length > 0 && (
          <BlurView intensity={40} tint="light" style={glass.card}>
            <View style={[glass.inner, { paddingBottom: 8 }]}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>📜 Repertoire</Text>
              {repSegs.map(seg => {
                const name = seg.compositionId ? compName(seg.compositionId) : seg.title;
                return (
                  <View key={seg.id} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLOURS.navy, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 16, color: COLOURS.text }}>📜 {name || 'Piece'}</Text>
                      {seg.duration ? <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.7)' }}><Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>⏱ {seg.duration}m</Text></View> : null}
                    </View>
                    {seg.section ? <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 2 }}>{seg.section}</Text> : null}
                    {seg.feltDifficulty ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>Difficulty</Text>
                        <View style={{ flexDirection: 'row', gap: 2 }}>
                          {[1,2,3,4,5].map(n => <Text key={n} style={{ fontSize: 13, opacity: n <= seg.feltDifficulty ? 1 : 0.18 }}>🎵</Text>)}
                        </View>
                      </View>
                    ) : null}
                    {seg.notes ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, marginTop: 4, lineHeight: 20 }}>{seg.notes}</Text> : null}
                    {((seg.challenges||[]).length > 0 || (seg.progress||[]).length > 0) && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                        {(seg.challenges||[]).map(t => <View key={t} style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: 'rgba(221,174,211,0.15)', borderRadius: RADIUS.pill }}><Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textMuted }}>{t}</Text></View>)}
                        {(seg.progress||[]).map(t => <View key={t} style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}><Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.navy }}>{t}</Text></View>)}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </BlurView>
        )}

        {/* Wins */}
        {session.wins ? (
          <BlurView intensity={40} tint="light" style={glass.card}>
            <View style={glass.inner}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>✨ Wins</Text>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 15, color: COLOURS.textMuted, lineHeight: 22 }}>{session.wins}</Text>
            </View>
          </BlurView>
        ) : null}

        {/* Next focus */}
        {session.tomorrowFocus ? (
          <BlurView intensity={40} tint="light" style={glass.card}>
            <View style={glass.inner}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>🎯 Next focus</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textMuted, lineHeight: 21 }}>{session.tomorrowFocus}</Text>
            </View>
          </BlurView>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <GlassBtn label="Export JSON" small onPress={() => exportSessionJSON(session, compositions).catch(() => {})} color={COLOURS.steel} />
          <GlassBtn label="Delete" danger small onPress={() => confirmDelete('Delete session?', fmtDate(session.date), () => onDeleteSession(session.id))} color={COLOURS.red} />
        </View>
      </View>
    );
  }

  if (lesson) {
    const compNames = [...new Set((lesson.pieces || []).map(p =>
      p.compositionId ? compName(p.compositionId) : p.pieceName
    ).filter(Boolean))];
    return (
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 26, color: COLOURS.text }}>{fmtDate(lesson.date)}</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginTop: 2 }}>🎓 {lesson.duration} min · {lesson.teacher}</Text>
          </View>
          <GlassBtn label="✕" onPress={onCloseLesson} color={COLOURS.textDim} />
        </View>

        {/* Energy + enjoyment */}
        {(lesson.energy || lesson.enjoyment) ? (
          <BlurView intensity={40} tint="light" style={glass.card}>
            <View style={glass.inner}>
              <View style={{ flexDirection: 'row', gap: 28 }}>
                {lesson.energy ? <View style={{ gap: 6 }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>⚡ Energy</Text><ZeldaMini emoji="⚡" value={energyToBar(lesson.energy)} size={22} /></View> : null}
                {lesson.enjoyment ? <View style={{ gap: 6 }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>❤️ Enjoyment</Text><ZeldaMini emoji="❤️" value={lesson.enjoyment} size={22} /></View> : null}
              </View>
            </View>
          </BlurView>
        ) : null}

        {/* Pieces */}
        {compNames.length > 0 && (
          <BlurView intensity={40} tint="light" style={glass.card}>
            <View style={[glass.inner, { paddingBottom: 8 }]}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>📜 Pieces</Text>
              {(lesson.pieces || []).map((item, i) => {
                const name = item.compositionId ? compName(item.compositionId) : item.pieceName;
                return (
                  <View key={i} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLOURS.amber, marginBottom: 10 }}>
                    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 16, color: COLOURS.text, marginBottom: 4 }}>📜 {name || 'Piece'}</Text>
                    {item.feedback ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, lineHeight: 20 }}>💬 {item.feedback}</Text> : null}
                    {item.assignment ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, lineHeight: 20, marginTop: 4 }}>📚 {item.assignment}</Text> : null}
                  </View>
                );
              })}
            </View>
          </BlurView>
        )}

        {/* Wins */}
        {lesson.wins ? (
          <BlurView intensity={40} tint="light" style={glass.card}>
            <View style={glass.inner}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>🌟 Wins</Text>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 15, color: COLOURS.textMuted, lineHeight: 22 }}>{lesson.wins}</Text>
            </View>
          </BlurView>
        ) : null}

        <GlassBtn label="Delete lesson" danger small onPress={() => confirmDelete('Delete lesson?', fmtDate(lesson.date), () => onDeleteLesson(lesson.id))} color={COLOURS.danger} />
      </View>
    );
  }

  return null;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen({ sessions, lessons, compositions, onSave, onSaveLesson, onDelete, onDeleteLesson, isDesktop }) {
  const today = todayISO();
  const [logModalDate,    setLogModalDate]    = useState(null);
  const [logModalSession, setLogModalSession] = useState(null);
  const [lessonModalDate, setLessonModalDate] = useState(null);
  const [detailSession,   setDetailSession]   = useState(null);
  const [detailLesson,    setDetailLesson]    = useState(null);
  const [rightPanel,      setRightPanel]      = useState(null); // 'detail-session' | 'detail-lesson' | 'log-session' | 'log-lesson'
  const [showAbout,       setShowAbout]       = useState(false);

  function openSession(s)  { if (isDesktop) { setDetailSession(s); setDetailLesson(null); setRightPanel('detail-session'); } else setDetailSession(s); }
  function openLesson(l)   { if (isDesktop) { setDetailLesson(l); setDetailSession(null); setRightPanel('detail-lesson'); } else setDetailLesson(l); }
  function openLogSession(date, session) {
    if (isDesktop) { setLogModalSession(session || null); setLogModalDate(date || today); setRightPanel('log-session'); }
    else { setLogModalSession(session || null); setLogModalDate(date || today); }
  }
  function openLogLesson(date) {
    if (isDesktop) { setLessonModalDate(date || today); setRightPanel('log-lesson'); }
    else setLessonModalDate(date || today);
  }
  function closeRight() { setRightPanel(null); setDetailSession(null); setDetailLesson(null); setLogModalDate(null); setLogModalSession(null); setLessonModalDate(null); }

  const todaySessions = useMemo(() => sessions.filter(s => s.date === today), [sessions, today]);
  const todayLessons  = useMemo(() => (lessons || []).filter(l => l.date === today), [lessons, today]);
  const hasToday = todaySessions.length > 0 || todayLessons.length > 0;

  const feedItems = useMemo(() => {
    const s = sessions.filter(s => s.date !== today).map(s => ({ ...s, _type: 'practice' }));
    const l = (lessons || []).filter(l => l.date !== today).map(l => ({ ...l, _type: 'lesson' }));
    return [...s, ...l].sort((a, b) =>
      b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }, [sessions, lessons, today]);

  const modals = (
    <>
      {!isDesktop && (
        <>
          <LogModal
            visible={!!logModalDate || !!logModalSession}
            initialDate={logModalSession?.date || logModalDate || ''}
            initialSession={logModalSession}
            compositions={compositions}
            onSave={s => { onSave(s); setLogModalDate(null); setLogModalSession(null); }}
            onClose={() => { setLogModalDate(null); setLogModalSession(null); }}
          />
          <LessonModal
            visible={!!lessonModalDate}
            initialDate={lessonModalDate || ''}
            compositions={compositions}
            onSave={l => { onSaveLesson(l); setLessonModalDate(null); }}
            onClose={() => setLessonModalDate(null)}
          />
          <SessionDetailModal
            visible={!!detailSession}
            session={detailSession}
            compositions={compositions}
            onClose={() => setDetailSession(null)}
            onDelete={id => { onDelete(id); setDetailSession(null); }}
            onEdit={s => { setDetailSession(null); setLogModalSession(s); }}
          />
          <LessonDetailModal
            visible={!!detailLesson}
            lesson={detailLesson}
            compositions={compositions}
            onClose={() => setDetailLesson(null)}
            onDelete={id => { onDeleteLesson(id); setDetailLesson(null); }}
          />
        </>
      )}
    </>
  );

  // Feed column (shared between desktop and mobile)
  const feedContent = (
    <>
      {/* Today */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Today</Text>
        {hasToday ? (
          <View style={{ gap: 10 }}>
            {todayLessons.map(l => (
              <LessonEntry key={l.id} lesson={l} compositions={compositions}
                isSelected={isDesktop && rightPanel === 'detail-lesson' && detailLesson?.id === l.id}
                onPress={() => openLesson(l)}
                showDate={false} />
            ))}
            {todaySessions.map(s => (
              <PracticeEntry key={s.id} session={s} compositions={compositions}
                isSelected={isDesktop && rightPanel === 'detail-session' && detailSession?.id === s.id}
                onPress={() => openSession(s)}
                showDate={false} />
            ))}
          </View>
        ) : (
          <View>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 15, color: COLOURS.textDim }}>No session logged yet.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity onPress={() => openLogSession(today)} activeOpacity={0.8}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:3}, shadowOpacity:1, shadowRadius:10, elevation:3 }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.practiceText }}>🎹 Log practice</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openLogLesson(today)} activeOpacity={0.8}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:3}, shadowOpacity:1, shadowRadius:10, elevation:3 }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.lessonText }}>🎓 Log lesson</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Feed */}
      {feedItems.length > 0 && (
        <>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
            Previous sessions
          </Text>
          {feedItems.map(item =>
            item._type === 'lesson' ? (
              <LessonEntry key={item.id} lesson={item} compositions={compositions}
                isSelected={isDesktop && rightPanel === 'detail-lesson' && detailLesson?.id === item.id}
                onPress={() => openLesson(item)} />
            ) : (
              <PracticeEntry key={item.id} session={item} compositions={compositions}
                isSelected={isDesktop && rightPanel === 'detail-session' && detailSession?.id === item.id}
                onPress={() => openSession(item)} />
            )
          )}
        </>
      )}

      {sessions.length === 0 && (lessons || []).length === 0 && (
        <View style={{ alignItems: 'center', padding: 32 }}>
          <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 16, color: COLOURS.textDim, textAlign: 'center', lineHeight: 24 }}>
            Your practice journal starts here.{'\n'}Log your first session above.
          </Text>
        </View>
      )}
    </>
  );

  // ── Desktop two-column layout ───────────────────────────────────────────────
  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        {/* Glass card — left column only */}
        <View style={{
          position: 'absolute',
          left: 0, right: '50%', top: 12, bottom: 12,
          borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.28)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.55)',
          shadowColor: 'rgba(9,99,126,0.12)',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 24,
          elevation: 2,
        }} />
        {/* Two-column layout on top */}
        <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Left: feed */}
        <View style={{ flex: 1, marginTop: 12, marginBottom: 12, overflow: 'hidden' }}>
          <ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 40, paddingLeft: 226, paddingRight: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 26, color: COLOURS.text }}>Home</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
            </View>
            {feedContent}
          </ScrollView>
          <FAB onPractice={() => openLogSession(today)} onLesson={() => openLogLesson(today)} />
        </View>

        {/* Right: detail / inline form panel */}
        <View style={{ flex: 1, minWidth: 0, marginLeft: 12, marginTop: 12, marginBottom: 12, marginRight: 12 }}>
          {rightPanel === 'log-session' && (
            <LogModal
              inline
              initialDate={logModalDate || today}
              initialSession={logModalSession}
              compositions={compositions}
              onSave={s => { onSave(s); closeRight(); }}
              onClose={closeRight}
            />
          )}
          {rightPanel === 'log-lesson' && (
            <LessonModal
              inline
              initialDate={lessonModalDate || today}
              compositions={compositions}
              onSave={l => { onSaveLesson(l); closeRight(); }}
              onClose={closeRight}
            />
          )}
          {(rightPanel === 'detail-session' || rightPanel === 'detail-lesson') && (
            <ScrollView contentContainerStyle={{ padding: 28, paddingBottom: 48 }}>
              <DesktopDetailPanel
                session={rightPanel === 'detail-session' ? detailSession : null}
                lesson={rightPanel === 'detail-lesson' ? detailLesson : null}
                compositions={compositions}
                onCloseSession={closeRight}
                onCloseLesson={closeRight}
                onDeleteSession={id => { onDelete(id); closeRight(); }}
                onDeleteLesson={id => { onDeleteLesson(id); closeRight(); }}
                onEditSession={s => openLogSession(s.date, s)}
              />
            </ScrollView>
          )}
          {!rightPanel && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 18, color: COLOURS.textDim, opacity: 0.5 }}>
                Select an entry to view details
              </Text>
            </View>
          )}
        </View>

        {modals}
        </View>
      </View>
    );
  }

  // ── Mobile single-column layout ─────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <TouchableOpacity
          onPress={() => setShowAbout(true)}
          activeOpacity={0.7}
          style={{ marginBottom: 20, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <Image source={require('../../assets/icon.png')} style={{ width: 44, height: 44, borderRadius: 10 }} />
          <View>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.screenTitle, color: COLOURS.text, letterSpacing: -0.5 }}>
              music<Text style={{ color: COLOURS.practiceText }}>.</Text><Text style={{ color: COLOURS.lessonText }}>log</Text>
            </Text>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textDim, marginTop: 2 }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
        </TouchableOpacity>
        {feedContent}
      </ScrollView>
      <FAB onPractice={() => openLogSession(today)} onLesson={() => openLogLesson(today)} />
      {modals}
      <Modal visible={showAbout} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAbout(false)}>
        <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
          <TouchableOpacity
            onPress={() => setShowAbout(false)}
            style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(9,99,126,0.12)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 16, color: COLOURS.navy }}>✕</Text>
          </TouchableOpacity>
          <AboutScreen isDesktop={false} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
