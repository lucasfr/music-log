// The desktop detail panel: the full view of one practice session or lesson, shown beside the feed.
// Moved out of HomeScreen.js unchanged.

import React from 'react';
import { View, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, SIZES, TOUCH_PILL, HIT_PILL, live } from '../../theme';
import { Tap as TouchableOpacity } from '../../components/Motion';
import { fmtDate, formatScaleEntry, formatTouch, formatTempo } from '../../utils';
import { exportSessionJSON, copySessionJSON } from '../../utils/export';
import { ENERGY_LABELS, energyToBar, ZeldaMini } from './helpers';

// ─── Shared glass helpers ────────────────────────────────────────────────────

const glass = live(() => ({
  card: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: COLOURS.shadow(0.08),
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  inner: {
    backgroundColor: COLOURS.w(0.45),
    padding: 14,
  },
}));

function GlassBtn({ label, onPress, color, danger, small }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} hitSlop={HIT_PILL} style={{ ...TOUCH_PILL,
      paddingHorizontal: small ? 10 : 16, paddingVertical: 8,
      alignSelf: small ? 'flex-start' : 'auto',
      borderRadius: RADIUS.pill,
      backgroundColor: danger ? COLOURS.dangerLight : COLOURS.w(0.55),
      shadowColor: danger ? COLOURS.dangerLight : COLOURS.navyA(0.08),
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1, shadowRadius: 6, elevation: 2,
    }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: small ? 12 : 14, color: color || COLOURS.navy }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Desktop detail panel ─────────────────────────────────────────────────────

export function DesktopDetailPanel({ session, lesson, compositions, onCloseSession, onCloseLesson, onDeleteSession, onDeleteLesson, onEditSession, onEditLesson }) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || null;

  if (session) {
    const techSegs = (session.segments || []).filter(s => s.type === 'technique');
    const repSegs  = (session.segments || []).filter(s => s.type === 'repertoire');
    const energyLabel = ENERGY_LABELS[String(session.energy)] || '';
    return (
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.display, color: COLOURS.text }}>{fmtDate(session.date)}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {onEditSession && <GlassBtn label="Edit" onPress={() => onEditSession(session)} color={COLOURS.steel} />}
            <GlassBtn label="✕" onPress={onCloseSession} color={COLOURS.textDim} />
          </View>
        </View>

        {/* Summary chips */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.practiceBg, shadowColor: COLOURS.accentMid, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.practiceText }}>🎹 practice</Text>
          </View>
          {session.duration ? (
            <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.65), shadowColor: COLOURS.shadow(0.10), shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.navy }}>⏱ {session.duration} min</Text>
            </View>
          ) : null}
        </View>

        {/* Energy + enjoyment glass card */}
        <BlurView intensity={40} tint={COLOURS.blurTint} style={glass.card}>
          <View style={glass.inner}>
            <View style={{ flexDirection: 'row', gap: 28 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>⚡ Energy · {session.energy > 0 ? `+${session.energy}` : session.energy} {energyLabel}</Text>
                <ZeldaMini emoji="⚡" value={energyToBar(session.energy)} size={22} />
              </View>
              {session.enjoyment ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>❤️ Enjoyment</Text>
                  <ZeldaMini emoji="❤️" value={session.enjoyment} size={22} />
                </View>
              ) : null}
            </View>
          </View>
        </BlurView>

        {/* Technique segments */}
        {techSegs.length > 0 && (
          <BlurView intensity={40} tint={COLOURS.blurTint} style={glass.card}>
            <View style={[glass.inner, { paddingBottom: 8 }]}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>🎹 Technique</Text>
              {techSegs.map(seg => (
                <View key={seg.id} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLOURS.steel, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text }}>
                      {compName(seg.compositionId) || seg.group || seg.title || 'Technical work'}
                    </Text>
                    {formatTouch(seg) ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.steelA(0.14) }}>
                        <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.navy }}>{formatTouch(seg)}</Text>
                      </View>
                    ) : null}
                    {formatTempo(seg) ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.7) }}>
                        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>{formatTempo(seg)}</Text>
                      </View>
                    ) : null}
                    {seg.compositionId && (seg.group || seg.title) ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.accent2Light }}>
                        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.steel }}>{seg.group || seg.title}</Text>
                      </View>
                    ) : null}
                    {seg.duration ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.7) }}><Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>⏱ {seg.duration}m</Text></View> : null}
                  </View>
                  {seg.scales?.length > 0 && <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted, marginTop: 2 }}>{seg.scales.map(s => formatScaleEntry(s, seg.octaves || 1)).join(' · ')}</Text>}
                  {seg.notes ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted, marginTop: 4, lineHeight: 20 }}>{seg.notes}</Text> : null}
                  {((seg.challenges||[]).length > 0 || (seg.progress||[]).length > 0) && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {(seg.challenges||[]).map(t => <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: COLOURS.challengeLight, borderRadius: RADIUS.pill }}><Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textMuted }}>{t}</Text></View>)}
                      {(seg.progress||[]).map(t => <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}><Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.navy }}>{t}</Text></View>)}
                    </View>
                  )}
                </View>
              ))}
            </View>
          </BlurView>
        )}

        {/* Repertoire segments */}
        {repSegs.length > 0 && (
          <BlurView intensity={40} tint={COLOURS.blurTint} style={glass.card}>
            <View style={[glass.inner, { paddingBottom: 8 }]}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>📜 Repertoire</Text>
              {repSegs.map(seg => {
                const name = seg.compositionId ? compName(seg.compositionId) : seg.title;
                return (
                  <View key={seg.id} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLOURS.navy, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.text }}>📜 {name || 'Piece'}</Text>
                      {seg.duration ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.7) }}><Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>⏱ {seg.duration}m</Text></View> : null}
                    </View>
                    {seg.section ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 2 }}>{seg.section}</Text> : null}
                    {seg.feltDifficulty ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>Difficulty</Text>
                        <View style={{ flexDirection: 'row', gap: 2 }}>
                          {[1,2,3,4,5].map(n => <Text key={n} style={{ fontSize: SIZES.label, opacity: n <= seg.feltDifficulty ? 1 : COLOURS.ratingEmpty }}>🎵</Text>)}
                        </View>
                      </View>
                    ) : null}
                    {seg.liking ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>Enjoyment</Text>
                        <View style={{ flexDirection: 'row', gap: 2 }}>
                          {[1,2,3,4,5].map(n => <Text key={n} style={{ fontSize: SIZES.label, opacity: n <= seg.liking ? 1 : COLOURS.ratingEmpty }}>⭐</Text>)}
                        </View>
                      </View>
                    ) : null}
                    {seg.notes ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted, marginTop: 4, lineHeight: 20 }}>{seg.notes}</Text> : null}
                    {((seg.challenges||[]).length > 0 || (seg.progress||[]).length > 0) && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {(seg.challenges||[]).map(t => <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: COLOURS.challengeLight, borderRadius: RADIUS.pill }}><Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textMuted }}>{t}</Text></View>)}
                        {(seg.progress||[]).map(t => <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}><Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.navy }}>{t}</Text></View>)}
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
          <BlurView intensity={40} tint={COLOURS.blurTint} style={glass.card}>
            <View style={glass.inner}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>✨ Wins</Text>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.textMuted, lineHeight: 22 }}>{session.wins}</Text>
            </View>
          </BlurView>
        ) : null}

        {/* Next focus */}
        {session.tomorrowFocus ? (
          <BlurView intensity={40} tint={COLOURS.blurTint} style={glass.card}>
            <View style={glass.inner}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>🎯 Next focus</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textMuted, lineHeight: 21 }}>{session.tomorrowFocus}</Text>
            </View>
          </BlurView>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <GlassBtn label="Export JSON" small onPress={() => exportSessionJSON(session, compositions).catch(() => {})} color={COLOURS.steel} />
          <GlassBtn label="Copy JSON" small onPress={() => copySessionJSON(session, compositions).catch(() => {})} color={COLOURS.steel} />
          <GlassBtn label="Delete" danger small onPress={() => onDeleteSession(session.id)} color={COLOURS.red} />
        </View>
      </View>
    );
  }

  if (lesson) {
    const allSegs  = lesson.segments || lesson.pieces || [];
    const techSegs = allSegs.filter(s => s.type === 'technique');
    const repSegs  = allSegs.filter(s => s.type === 'repertoire');
    const energyLabel = ENERGY_LABELS[String(lesson.energy)] || '';
    return (
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.display, color: COLOURS.text }}>{fmtDate(lesson.date)}</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 2 }}>🎓 Lesson{lesson.teacher ? ` · ${lesson.teacher}` : ''}{lesson.duration ? ` · ${lesson.duration} min` : ''}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {onEditLesson && <GlassBtn label="Edit" onPress={() => onEditLesson(lesson)} color={COLOURS.steel} />}
            <GlassBtn label="✕" onPress={onCloseLesson} color={COLOURS.textDim} />
          </View>
        </View>

        {/* Summary chip */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.lessonBg, shadowColor: COLOURS.accent2Mid, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.lessonText }}>🎓 lesson</Text>
          </View>
          {lesson.duration ? (
            <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.65), shadowColor: COLOURS.shadow(0.10), shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.navy }}>⏱ {lesson.duration} min</Text>
            </View>
          ) : null}
        </View>

        {/* Energy + enjoyment */}
        {(lesson.energy != null || lesson.enjoyment) ? (
          <BlurView intensity={40} tint={COLOURS.blurTint} style={glass.card}>
            <View style={glass.inner}>
              <View style={{ flexDirection: 'row', gap: 28 }}>
                {lesson.energy != null ? <View style={{ gap: 6 }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>⚡ Energy{energyLabel ? ` · ${energyLabel}` : ''}</Text><ZeldaMini emoji="⚡" value={energyToBar(lesson.energy)} size={22} /></View> : null}
                {lesson.enjoyment ? <View style={{ gap: 6 }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>❤️ Enjoyment</Text><ZeldaMini emoji="❤️" value={lesson.enjoyment} size={22} /></View> : null}
              </View>
            </View>
          </BlurView>
        ) : null}

        {/* Technique segments */}
        {techSegs.length > 0 && (
          <BlurView intensity={40} tint={COLOURS.blurTint} style={glass.card}>
            <View style={[glass.inner, { paddingBottom: 8 }]}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>🎹 Technique</Text>
              {techSegs.map(seg => (
                <View key={seg.id} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLOURS.steel, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text }}>{seg.group || seg.title || 'Technical work'}</Text>
                    {formatTouch(seg) ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.steelA(0.14) }}>
                        <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.navy }}>{formatTouch(seg)}</Text>
                      </View>
                    ) : null}
                    {formatTempo(seg) ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.7) }}>
                        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>{formatTempo(seg)}</Text>
                      </View>
                    ) : null}
                    {seg.duration ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.7) }}><Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>⏱ {seg.duration}m</Text></View> : null}
                  </View>
                  {seg.scales?.length > 0 && <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted, marginTop: 2 }}>{seg.scales.map(s => formatScaleEntry(s, seg.octaves || 1)).join(' · ')}</Text>}
                  {seg.feedback ? <View style={{ marginTop: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: COLOURS.steel }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>💬 Feedback</Text><Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted, lineHeight: 20 }}>{seg.feedback}</Text></View> : null}
                  {seg.assignment ? <View style={{ marginTop: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: COLOURS.navy }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>📚 Assignment</Text><Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted, lineHeight: 20 }}>{seg.assignment}</Text></View> : null}
                  {seg.notes ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted, marginTop: 4, lineHeight: 20 }}>{seg.notes}</Text> : null}
                  {((seg.challenges||[]).length > 0 || (seg.progress||[]).length > 0) && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {(seg.challenges||[]).map(t => <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: COLOURS.challengeLight, borderRadius: RADIUS.pill }}><Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textMuted }}>{t}</Text></View>)}
                      {(seg.progress||[]).map(t => <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}><Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.navy }}>{t}</Text></View>)}
                    </View>
                  )}
                </View>
              ))}
            </View>
          </BlurView>
        )}

        {/* Repertoire segments */}
        {repSegs.length > 0 && (
          <BlurView intensity={40} tint={COLOURS.blurTint} style={glass.card}>
            <View style={[glass.inner, { paddingBottom: 8 }]}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>📜 Repertoire</Text>
              {repSegs.map(seg => {
                const name = seg.compositionId ? compName(seg.compositionId) : (seg.title || seg.pieceName);
                return (
                  <View key={seg.id} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLOURS.amber, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.text }}>📜 {name || 'Piece'}</Text>
                      {seg.isNew && <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.pinkLight }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny, color: COLOURS.lessonText }}>new</Text></View>}
                      {seg.duration ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.7) }}><Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>⏱ {seg.duration}m</Text></View> : null}
                    </View>
                    {seg.section ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 2 }}>{seg.section}</Text> : null}
                    {seg.feedback ? <View style={{ marginTop: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: COLOURS.steel }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>💬 Feedback</Text><Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted, lineHeight: 20 }}>{seg.feedback}</Text></View> : null}
                    {seg.assignment ? <View style={{ marginTop: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: COLOURS.navy }}><Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>📚 Assignment</Text><Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted, lineHeight: 20 }}>{seg.assignment}</Text></View> : null}
                    {seg.feltDifficulty ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>Difficulty</Text>
                        <View style={{ flexDirection: 'row', gap: 2 }}>{[1,2,3,4,5].map(n => <Text key={n} style={{ fontSize: SIZES.label, opacity: n <= seg.feltDifficulty ? 1 : COLOURS.ratingEmpty }}>🎵</Text>)}</View>
                      </View>
                    ) : null}
                    {seg.liking ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>Liking</Text>
                        <View style={{ flexDirection: 'row', gap: 2 }}>{[1,2,3,4,5].map(n => <Text key={n} style={{ fontSize: SIZES.label, opacity: n <= seg.liking ? 1 : COLOURS.ratingEmpty }}>⭐</Text>)}</View>
                      </View>
                    ) : null}
                    {seg.notes ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted, marginTop: 4, lineHeight: 20 }}>{seg.notes}</Text> : null}
                    {((seg.challenges||[]).length > 0 || (seg.progress||[]).length > 0) && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {(seg.challenges||[]).map(t => <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: COLOURS.challengeLight, borderRadius: RADIUS.pill }}><Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textMuted }}>{t}</Text></View>)}
                        {(seg.progress||[]).map(t => <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}><Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.navy }}>{t}</Text></View>)}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </BlurView>
        )}

        {/* Lesson notes */}
        {lesson.overallNotes ? (
          <BlurView intensity={40} tint={COLOURS.blurTint} style={glass.card}>
            <View style={glass.inner}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>✨ Lesson notes</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textMuted, lineHeight: 21 }}>{lesson.overallNotes}</Text>
            </View>
          </BlurView>
        ) : null}

        {/* Wins */}
        {lesson.wins ? (
          <BlurView intensity={40} tint={COLOURS.blurTint} style={glass.card}>
            <View style={glass.inner}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>🌟 Wins</Text>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.textMuted, lineHeight: 22 }}>{lesson.wins}</Text>
            </View>
          </BlurView>
        ) : null}

        {/* Next focus */}
        {lesson.nextFocus ? (
          <BlurView intensity={40} tint={COLOURS.blurTint} style={glass.card}>
            <View style={glass.inner}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>🎯 Focus before next lesson</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textMuted, lineHeight: 21 }}>{lesson.nextFocus}</Text>
            </View>
          </BlurView>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <GlassBtn label="Export JSON" small onPress={() => exportSessionJSON(lesson, compositions).catch(() => {})} color={COLOURS.steel} />
          <GlassBtn label="Copy JSON" small onPress={() => copySessionJSON(lesson, compositions).catch(() => {})} color={COLOURS.steel} />
          <GlassBtn label="Delete" danger small onPress={() => onDeleteLesson(lesson.id)} color={COLOURS.red} />
        </View>
      </View>
    );
  }

  return null;
}
