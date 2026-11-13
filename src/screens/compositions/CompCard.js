// A piece's card in the library list: the summary, and the five tabs it opens into (details, notes,
// study, resources, sessions). Moved out of CompositionsScreen.js unchanged.

import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Tap as TouchableOpacity } from '../../components/Motion';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, SIZES, STATUS_COLOURS, TOUCH_PILL, HIT_PILL } from '../../theme';
import { Btn, BtnRow, StatusPill, MetaChip } from '../../components/UI';
import { fmtDate } from '../../utils';

// ─── Composition card ─────────────────────────────────────────────────────────

function DifficultyDisplay({ value }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Text key={n} style={{ fontSize: SIZES.bodySmall, opacity: n <= value ? 1 : COLOURS.ratingEmpty, transform: [{ scale: n <= value ? 1 : 0.88 }] }}>🎹</Text>
      ))}
    </View>
  );
}

function NoteSection({ label, value }) {
  if (!value) return null;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</Text>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textMuted, lineHeight: 22 }}>{value}</Text>
    </View>
  );
}

// The short summary under a piece's title: grade, keys, time signatures and tempo on one quiet
// line, then the two ratings. Collection, tags and dates live in the expanded Details tab, so a
// card in the list stays easy to scan.
function CardSummary({ comp }) {
  const keyLabels = (comp.keys && comp.keys.length > 0
    ? comp.keys
    : comp.keyRoot ? [{ root: comp.keyRoot, mode: comp.keyMode }] : []
  ).filter(k => k.root).map(k => `${k.root} ${k.mode || ''}`.trim());
  const sigs = comp.timeSigs && comp.timeSigs.length > 0 ? comp.timeSigs : comp.timeSig ? [comp.timeSig] : [];
  const line = [comp.grade, keyLabels.join(', '), sigs.join(', '), comp.tempo ? `♪ ${comp.tempo} bpm` : '']
    .filter(Boolean).join('  ·  ');
  const rated = comp.difficulty > 0 || comp.liking > 0;
  if (!line && !rated) return null;
  return (
    <View style={{ marginTop: 8 }}>
      {line ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted, lineHeight: 19 }}>{line}</Text> : null}
      {rated ? (
        <View style={{ flexDirection: 'row', gap: 14, marginTop: line ? 6 : 0, alignItems: 'center' }}>
          {comp.difficulty > 0 && <DifficultyDisplay value={comp.difficulty} />}
          {comp.liking > 0 && (
            <View style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
              {[1,2,3,4,5].map(n => (
                <Text key={n} style={{ fontSize: SIZES.bodySmall, opacity: n <= comp.liking ? 1 : COLOURS.ratingEmpty }}>⭐</Text>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

export function CompCard({ comp, sessions, onEdit, onDelete, onOpenPage }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState('details');
  const shadowColor = (STATUS_COLOURS[comp.status] || {}).border || COLOURS.accentMid;

  const compSessions = sessions
    .filter(s => (s.segments || []).some(sg => sg.compositionId === comp.id))
    .slice(0, 10);

  const TABS = ['details', 'notes', 'study', 'resources', 'sessions'];

  return (
    <BlurView intensity={32} tint={COLOURS.blurTint} style={{
      borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 12,
      shadowColor: shadowColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 5,
    }}>
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.8} style={{ padding: 14, backgroundColor: COLOURS.glass }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.cardTitle, color: COLOURS.text, marginBottom: 2 }}>📜 {comp.title}</Text>
            {comp.composer ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted }}>{comp.composer}</Text> : null}
            {comp.arrangement ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 1 }}>arr. {comp.arrangement}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6, marginLeft: 10 }}>
            <StatusPill status={comp.status} />
            <Text style={{ fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>{expanded ? '▲' : '▼'}</Text>
          </View>
        </View>

        <CardSummary comp={comp} />
      </TouchableOpacity>

      {expanded && (
        <View style={{ backgroundColor: COLOURS.w(0.30) }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 10, gap: 6, flexDirection: 'row' }}>
            {TABS.map(t => (
              <TouchableOpacity key={t} onPress={() => setTab(t)} activeOpacity={0.75}
                hitSlop={HIT_PILL} style={{ ...TOUCH_PILL,
                  paddingVertical: 6, paddingHorizontal: 14,
                  borderRadius: RADIUS.pill,
                  backgroundColor: tab === t ? COLOURS.navy : COLOURS.w(0.55),
                  shadowColor: tab === t ? COLOURS.navyA(0.3) : COLOURS.glassShadow,
                  shadowOffset: { width: 0, height: tab === t ? 3 : 1 },
                  shadowOpacity: 1, shadowRadius: tab === t ? 8 : 4, elevation: tab === t ? 3 : 1,
                }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: tab === t ? COLOURS.onNavy : COLOURS.textMuted }}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ padding: 14 }}>
            {tab === 'details' && (
              <>
                {(comp.collection || (comp.tags || []).length > 0) ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {comp.collection ? <MetaChip label={comp.collection} /> : null}
                    {(comp.tags || []).map(t => <MetaChip key={t} label={t} />)}
                  </View>
                ) : null}
                {(comp.dateStarted || comp.dateCompleted) ? (
                  <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginBottom: 12 }}>
                    {[comp.dateStarted ? `Started ${comp.dateStarted}` : '', comp.dateCompleted ? `Completed ${comp.dateCompleted}` : ''].filter(Boolean).join('  ·  ')}
                  </Text>
                ) : null}
                {comp.info ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textMuted, lineHeight: 22, marginBottom: 14 }}>{comp.info}</Text> : null}
                <BtnRow>
                  <Btn label="Remove" variant="danger" onPress={() => onDelete(comp.id)} />
                  {onOpenPage ? <Btn label="Progress" onPress={() => onOpenPage(comp.id)} /> : null}
                  <Btn label="Edit" onPress={() => onEdit(comp)} />
                </BtnRow>
              </>
            )}

            {tab === 'notes' && (
              <>
                <NoteSection label="💬 Teacher's notes" value={comp.kerrinNotes} />
                <NoteSection label="📚 Teacher feedback" value={comp.teacherFeedback} />
                <NoteSection label="💡 My notes" value={comp.myNotes} />
                {!comp.kerrinNotes && !comp.teacherFeedback && !comp.myNotes &&
                  <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim, fontSize: SIZES.label }}>No notes yet.</Text>
                }
              </>
            )}

            {tab === 'study' && (
              <>
                <NoteSection label="🚧 Technical challenges" value={comp.technicalChallenges} />
                <NoteSection label="🎶 Musical focus areas" value={comp.musicalFocus} />
                <NoteSection label="🔄 Practice notes" value={comp.practiceNotes} />
                {!comp.technicalChallenges && !comp.musicalFocus && !comp.practiceNotes &&
                  <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim, fontSize: SIZES.label }}>No study notes yet.</Text>
                }
              </>
            )}

            {tab === 'resources' && (
              <>
                <NoteSection label="🎼 Sheet music" value={comp.resourceSheet} />
                <NoteSection label="🎧 Recording references" value={comp.resourceRecordings} />
                <NoteSection label="🎥 Tutorial videos" value={comp.resourceTutorials} />
                {!comp.resourceSheet && !comp.resourceRecordings && !comp.resourceTutorials &&
                  <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim, fontSize: SIZES.label }}>No resources added yet.</Text>
                }
              </>
            )}

            {tab === 'sessions' && (
              <>
                {compSessions.length === 0 ? (
                  <Text style={{ fontFamily: 'Lato', color: COLOURS.textDim, fontSize: SIZES.label }}>No sessions logged yet for this piece.</Text>
                ) : compSessions.map(s => {
                  const seg = (s.segments || []).find(sg => sg.compositionId === comp.id);
                  const energyBar = (s.energy ?? 0) + 3;
                  return (
                    <View key={s.id} style={{ padding: 12, borderRadius: RADIUS.md, backgroundColor: COLOURS.w(0.55), shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2, marginBottom: 10 }}>

                      {/* Header row: date + duration */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text }}>{fmtDate(s.date)}</Text>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          {seg?.duration ? (
                            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.tealAccent }}>
                              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.navy }}>⏱ {seg.duration} min</Text>
                            </View>
                          ) : null}
                          {s.duration ? (
                            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.6) }}>
                              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>{s.duration} min total</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      {/* Energy + enjoyment */}
                      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', gap: 2 }}>
                          {[1,2,3,4,5].map(n => (
                            <Text key={n} style={{ fontSize: SIZES.bodySmall, opacity: n <= energyBar ? 1 : COLOURS.ratingEmpty }}>⚡</Text>
                          ))}
                        </View>
                        {s.enjoyment ? (
                          <View style={{ flexDirection: 'row', gap: 2 }}>
                            {[1,2,3,4,5].map(n => (
                              <Text key={n} style={{ fontSize: SIZES.bodySmall, opacity: n <= s.enjoyment ? 1 : COLOURS.ratingEmpty }}>❤️</Text>
                            ))}
                          </View>
                        ) : null}
                      </View>

                      {/* Section */}
                      {seg?.section ? (
                        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginBottom: 4 }}>📍 {seg.section}</Text>
                      ) : null}

                      {/* Felt difficulty + piece liking */}
                      {(seg?.feltDifficulty > 0 || seg?.liking > 0) ? (
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 4, alignItems: 'center' }}>
                          {seg?.feltDifficulty > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>Difficulty</Text>
                              <View style={{ flexDirection: 'row', gap: 2 }}>
                                {[1,2,3,4,5].map(n => (
                                  <Text key={n} style={{ fontSize: SIZES.label, opacity: n <= seg.feltDifficulty ? 1 : COLOURS.ratingEmpty }}>🎵</Text>
                                ))}
                              </View>
                            </View>
                          )}
                          {seg?.liking > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>Enjoyment</Text>
                              <View style={{ flexDirection: 'row', gap: 2 }}>
                                {[1,2,3,4,5].map(n => (
                                  <Text key={n} style={{ fontSize: SIZES.label, opacity: n <= seg.liking ? 1 : COLOURS.ratingEmpty }}>⭐</Text>
                                ))}
                              </View>
                            </View>
                          )}
                        </View>
                      ) : null}

                      {/* Notes */}
                      {seg?.notes ? (
                        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted, marginTop: 4, lineHeight: 19 }}>{seg.notes}</Text>
                      ) : null}

                      {/* Challenge + progress tags */}
                      {((seg?.challenges || []).length > 0 || (seg?.progress || []).length > 0) && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {(seg?.challenges || []).map(t => (
                            <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: COLOURS.challengeLight, borderRadius: RADIUS.pill }}>
                              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textMuted }}>🚧 {t}</Text>
                            </View>
                          ))}
                          {(seg?.progress || []).map(t => (
                            <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: COLOURS.accentLight, borderRadius: RADIUS.pill }}>
                              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.navy }}>✅ {t}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Session-level wins */}
                      {s.wins ? (
                        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted, marginTop: 6, fontStyle: 'italic' }}>✨ {s.wins}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        </View>
      )}
    </BlurView>
  );
}
