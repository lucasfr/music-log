import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '../components/Icon';
import { COLOURS, RADIUS, SIZES, STATUS_COLOURS, TOUCH_PILL, HIT_PILL } from '../theme';
import { GlassCard, SectionTitle, Label } from '../components/UI';
import { useNavScrollHandler } from '../context/NavScrollContext';
import { parseTarget } from '../utils/insights';
import { GradeTargetCard } from '../components/GradeTargetCard';
import { PieceDetailModal } from '../components/PieceDetailModal';
import { usePref } from '../utils/usePref';
import { RunThroughsCard } from '../components/RunThroughsCard';
import { inPeriod, longestStreak, periodAverages, daysSinceLatest, pieceStats } from '../utils/statsCalc';
import { FadeInUp, Tap as TouchableOpacity } from '../components/Motion';
import { parseCollapsed, serializeCollapsed, toggleCollapsed } from '../utils/collapsed';
import { STATUS_OPTIONS } from '../constants';
import { getLocalPref, setLocalPref, todayISO } from '../utils';
import { STATUS_EMOJI, ZeldaBarFractional } from './stats/shared';
import { ActivityGrid } from './stats/ActivityGrid';
import { PracticeVolumeChart, WeeklyTrendChart, ScatterPlot, DayOfWeekChart } from './stats/TrendCharts';
import { NeglectedPieces, WinsTimeline, StreakHistory, LessonInsights, LibraryGrowthChart, GradePathway } from './stats/LibrarySections';
import { TechniqueBreakdown, ScaleCoverage, StaleScales } from './stats/TechniqueSections';
import { TempoProgress } from './stats/TempoSections';

// The sections themselves live in ./stats/ (one file per group of charts); this file is the page:
// the period switch, the overview tiles, and the folding sections that hold them.

// One section of the page with a tappable title that folds it away. Stats is about nine screens
// long on a phone, so you can fold what you don't look at; the choice is remembered.
function StatsSection({ id, title, first, collapsed, onToggle, children }) {
  const open = !collapsed.includes(id);
  // The content eases in when a folded section is opened, but not when the screen first appears.
  const wasOpen = useRef(open);
  const justOpened = open && !wasOpen.current;
  useEffect(() => { wasOpen.current = open; }, [open]);
  return (
    <View>
      <TouchableOpacity onPress={() => onToggle(id)} activeOpacity={0.8} hitSlop={HIT_PILL}
        accessibilityRole="button" accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${open ? 'expanded' : 'collapsed'}`}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44, marginTop: first ? 0 : 8 }}>
        <SectionTitle style={{ marginTop: 0, marginBottom: 0, flex: 1 }}>{title}</SectionTitle>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={COLOURS.textDim} />
      </TouchableOpacity>
      {open ? (
        <FadeInUp skip={!justOpened} distance={10}>
          <View style={{ marginTop: 8 }}>{children}</View>
        </FadeInUp>
      ) : null}
    </View>
  );
}

export default function StatsScreen({ sessions, compositions, lessons, isDesktop, onSaveComposition }) {
  // The page for one piece, opened from the tempo list, and the exam date from the grade target (it
  // decides whether a piece is on track for its tempo).
  const [openPieceId, setOpenPieceId] = useState(null);
  const [targetRaw] = usePref('gradeTarget', '');
  const examDate = useMemo(() => (parseTarget(targetRaw) || {}).date || '', [targetRaw]);
  const openPiece = openPieceId ? (compositions.find(c => c.id === openPieceId) || null) : null;
  const onNavScroll = useNavScrollHandler(); // collapses the floating tab pill on scroll, like Home
  const [period, setPeriod] = useState('30d');
  const [pieceSort, setPieceSort] = useState('count');
  const [collapsed, setCollapsed] = useState(() => parseCollapsed(getLocalPref('statsCollapsed', '[]')));
  function toggleSection(id) {
    const next = toggleCollapsed(collapsed, id);
    setCollapsed(next);
    setLocalPref('statsCollapsed', serializeCollapsed(next));
  }
  // A brand-new install has nothing to chart: say so once, instead of eight sections that are each empty.
  const noData = sessions.length === 0 && (lessons || []).length === 0 && compositions.length === 0;

  const PERIODS = [
    { key: '7d',  label: '7 days' },
    { key: '30d', label: '30 days' },
    { key: 'all', label: 'All time' },
  ];

  const today = todayISO();
  const periodSessions = useMemo(() => inPeriod(sessions, period, today), [sessions, period, today]);
  const periodLessons  = useMemo(() => inPeriod(lessons || [], period, today), [lessons, period, today]);

  const { totalMin, avgEnergy: avgEnergyNum, avgEnjoyment: avgEnjoymentFill } = useMemo(() => periodAverages(periodSessions), [periodSessions]);
  const allTimeMin  = useMemo(() => sessions.reduce((a, s) => a + (Number(s.duration) || 0), 0), [sessions]);
  // Energy: convert -2…+2 scale to 0…5 fill for the Zelda bar
  const energyFill    = avgEnergyNum !== null ? avgEnergyNum + 3 : null; // -2→1, 0→3, +2→5

  const streak = useMemo(() => longestStreak(periodSessions, period, today), [periodSessions, period, today]);


  const { byCount: topPieces, byTime: topPiecesByTime } = useMemo(() => pieceStats(periodSessions, compositions), [periodSessions, compositions]);

  const activePieces = pieceSort === 'time' ? topPiecesByTime : topPieces;
  const activePieceMax = pieceSort === 'time'
    ? (topPiecesByTime[0]?.mins || 1)
    : (topPieces[0]?.count || 1);
  const timeStr = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

  const periodLabel = period === 'all' ? 'all time' : period === '7d' ? '7d' : '30d';

  const daysSinceSession = useMemo(() => daysSinceLatest(sessions, today), [sessions, today]);

  const daysSinceLesson = useMemo(() => daysSinceLatest(lessons || [], today), [lessons, today]);

  const statItems = [
    { value: totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${Math.round(totalMin)}m`, label: `practice (${periodLabel})`, emoji: '⏱', allTime: period !== 'all' ? (allTimeMin >= 60 ? `${Math.floor(allTimeMin / 60)}h ${allTimeMin % 60}m total` : `${Math.round(allTimeMin)}m total`) : null },
    { value: periodSessions.length, label: `sessions (${periodLabel})`,  emoji: '🎹' },
    { value: periodLessons.length,  label: `lessons (${periodLabel})`,   emoji: '🎓' },
    { value: streak,         label: `best streak (${periodLabel})`,   emoji: '🔥' },
    { value: null, fill: energyFill,    label: `avg energy (${periodLabel})`,    emoji: '⚡', type: 'energy' },
    { value: null, fill: avgEnjoymentFill, label: `avg enjoyment (${periodLabel})`, emoji: '❤️', type: 'enjoyment' },
    { value: daysSinceSession === null ? '—' : daysSinceSession === 0 ? 'today' : `${daysSinceSession}d`, label: 'since practice', icon: 'calendar-outline',
      urgent: daysSinceSession !== null && daysSinceSession >= 3 },
    { value: daysSinceLesson === null ? '—' : daysSinceLesson === 0 ? 'today' : `${daysSinceLesson}d`, label: 'since lesson', icon: 'school-outline',
      urgent: daysSinceLesson !== null && daysSinceLesson >= 16 },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView onScroll={onNavScroll} scrollEventThrottle={16} contentContainerStyle={{ padding: 16, paddingLeft: isDesktop ? 226 : 16, paddingBottom: isDesktop ? 40 : 120 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
          <SectionTitle style={{ marginBottom: 0 }}>Overview</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {PERIODS.map(p => {
              const active = period === p.key;
              return (
                <TouchableOpacity key={p.key} onPress={() => setPeriod(p.key)} activeOpacity={0.75}
                  hitSlop={HIT_PILL} style={{ ...TOUCH_PILL,
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill,
                    backgroundColor: active ? COLOURS.navy : COLOURS.w(0.55),
                    shadowColor: active ? COLOURS.glassShadowMd : COLOURS.glassShadow,
                    shadowOffset: { width: 0, height: active ? 3 : 1 },
                    shadowOpacity: 1, shadowRadius: active ? 8 : 4, elevation: active ? 3 : 1,
                  }}>
                  <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: SIZES.label, color: active ? COLOURS.onNavy : COLOURS.textMuted }}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Stat tiles */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24, alignItems: 'stretch' }}>
          {statItems.map((item, i) => (
            <View key={i} style={{ flexBasis: '11%', flexGrow: 1, minWidth: isDesktop ? 0 : '30%' }}>
              <BlurView intensity={50} tint={COLOURS.blurTint} style={{ borderRadius: RADIUS.md, overflow: 'hidden', shadowColor: COLOURS.glassShadowMd, shadowOffset:{width:0,height:4}, shadowOpacity:1, shadowRadius:16, elevation:4, flex: 1 }}>
                <View style={{ backgroundColor: COLOURS.glass, paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', flex: 1, justifyContent: 'center', borderWidth: 1, borderColor: COLOURS.w(0.6) }}>
                  {item.icon ? (
                    // A themed line icon rather than an emoji: the 🎼 was a black glyph that vanished on a dark card,
                    // and the pair of "since" tiles should match.
                    <View style={{ height: 34, justifyContent: 'center', marginBottom: 8 }}>
                      <Ionicons name={item.icon} size={28} color={COLOURS.steel} />
                    </View>
                  ) : (
                    <Text style={{ fontSize: SIZES.screenTitle, lineHeight: 34, marginBottom: 8, color: COLOURS.steel }}>{item.emoji}</Text>
                  )}
                  {(item.type === 'energy' || item.type === 'enjoyment') ? (
                    item.fill !== null
                      ? <ZeldaBarFractional emoji={item.emoji} fill={item.fill} size={16} />
                      : <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.display, color: COLOURS.navy, lineHeight: 28 }}>—</Text>
                  ) : (
                    <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.screenTitle, color: item.urgent ? COLOURS.red : COLOURS.navy, lineHeight: 32, fontVariant: ['lining-nums'] }}>{item.value}</Text>
                  )}
                  <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 4, textAlign: 'center', letterSpacing: 0.2 }}>{item.label}</Text>
                  {item.allTime ? <Text style={{ fontFamily: 'Lato', fontSize: SIZES.tiny, color: COLOURS.textDim, marginTop: 2, textAlign: 'center', opacity: 0.7 }}>{item.allTime}</Text> : null}
                </View>
              </BlurView>
            </View>
          ))}
        </View>

        {noData ? (
          <GlassCard>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.cardTitle, color: COLOURS.text, marginBottom: 6 }}>Nothing to chart yet.</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textDim, lineHeight: 21 }}>Log a practice, a lesson or a piece and your stats will build up here: volume, energy and enjoyment, scales covered, and how your library is growing.</Text>
          </GlassCard>
        ) : (<>
        <StatsSection id="activity" title="Activity" first collapsed={collapsed} onToggle={toggleSection}>
        <GlassCard>
          <ActivityGrid sessions={sessions} lessons={lessons} compositions={compositions} />
        </GlassCard>

        </StatsSection>
        <StatsSection id="trends" title={`${period === '7d' ? 'Daily' : 'Weekly'} trends & session quality (${periodLabel})`} collapsed={collapsed} onToggle={toggleSection}>
        <GlassCard>
          <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 0, alignItems: isDesktop ? 'flex-start' : 'stretch' }}>
            <View style={{ flex: isDesktop ? 1 : undefined, paddingRight: isDesktop ? 20 : 0 }}>
              <Label>Practice volume</Label>
              <PracticeVolumeChart sessions={sessions} period={period} />
            </View>
            {isDesktop && <View style={{ width: 1, backgroundColor: COLOURS.glassBorderSubtle, alignSelf: 'stretch', marginHorizontal: 4 }} />}
            <View style={{ flex: isDesktop ? 1 : undefined, paddingLeft: isDesktop ? 20 : 0, marginTop: isDesktop ? 0 : 16 }}>
              <Label>{period === '7d' ? 'Daily' : 'Weekly'} trends</Label>
              <WeeklyTrendChart sessions={sessions} period={period} />
            </View>
            {isDesktop && <View style={{ width: 1, backgroundColor: COLOURS.glassBorderSubtle, alignSelf: 'stretch', marginHorizontal: 4 }} />}
            <View style={{ flex: isDesktop ? 1 : undefined, paddingLeft: isDesktop ? 20 : 0, marginTop: isDesktop ? 0 : 16 }}>
              <Label>Session quality</Label>
              <ScatterPlot sessions={periodSessions} />
            </View>
            {isDesktop && <View style={{ width: 1, backgroundColor: COLOURS.glassBorderSubtle, alignSelf: 'stretch', marginHorizontal: 4 }} />}
            <View style={{ flex: isDesktop ? 1 : undefined, paddingLeft: isDesktop ? 20 : 0, marginTop: isDesktop ? 0 : 16 }}>
              <Label>Day of week (all time)</Label>
              <DayOfWeekChart sessions={sessions} />
            </View>
          </View>
        </GlassCard>

        </StatsSection>
        <StatsSection id="technique" title={`Technique & scales (${periodLabel})`} collapsed={collapsed} onToggle={toggleSection}>
        <GlassCard>
          <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 0, alignItems: isDesktop ? 'flex-start' : 'stretch' }}>
            <View style={{ flex: isDesktop ? 1 : undefined, minWidth: 0, paddingRight: isDesktop ? 20 : 0 }}>
              <Label>Groups</Label>
              <TechniqueBreakdown sessions={periodSessions} />
            </View>
            {isDesktop && <View style={{ width: 1, backgroundColor: COLOURS.glassBorderSubtle, alignSelf: 'stretch', marginHorizontal: 4 }} />}
            <View style={{ width: isDesktop ? 600 : '100%', flexShrink: 0, paddingLeft: isDesktop ? 20 : 0, marginTop: isDesktop ? 0 : 16 }}>
              <Label>Keys ({periodLabel})</Label>
              <ScaleCoverage sessions={periodSessions} />
            </View>
          </View>
        </GlassCard>

        </StatsSection>
        <StatsSection id="tempo" title="Tempo progress" collapsed={collapsed} onToggle={toggleSection}>
        <GlassCard>
          <TempoProgress sessions={sessions} compositions={compositions} examDate={examDate} onOpenPiece={setOpenPieceId} />
        </GlassCard>

        </StatsSection>
        <StatsSection id="runthroughs" title="Run-throughs" collapsed={collapsed} onToggle={toggleSection}>
        <GlassCard>
          <RunThroughsCard sessions={sessions} compositions={compositions} />
        </GlassCard>

        </StatsSection>
        <StatsSection id="library" title="Library" collapsed={collapsed} onToggle={toggleSection}>
        {compositions.length === 0 ? (
          <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.textDim, marginBottom: 12 }}>No pieces in the library yet.</Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          {STATUS_OPTIONS.map(s => {
            const sc = STATUS_COLOURS[s] || {};
            const count = compositions.filter(c => c.status === s).length;
            if (count === 0) return null;
            return (
              <BlurView
                key={s}
                intensity={44}
                tint={COLOURS.blurTint}
                style={{
                  flexGrow: 1, minWidth: isDesktop ? 100 : '30%', borderRadius: RADIUS.md, overflow: 'hidden',
                  shadowColor: sc.border || COLOURS.accentMid,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.7, shadowRadius: 12, elevation: 3,
                }}
              >
                <View style={{ backgroundColor: sc.bg || COLOURS.glass, padding: 16, borderWidth: 1, borderColor: COLOURS.w(0.5) }}>
                  <Text style={{ fontSize: SIZES.screenTitle, lineHeight: 34, marginBottom: 8, color: sc.text || COLOURS.navy }}>
                    {STATUS_EMOJI[s] || '🎵'}
                  </Text>
                  <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.screenTitle, color: sc.text || COLOURS.navy, lineHeight: 32 }}>
                    {count}
                  </Text>
                  <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: sc.text || COLOURS.textDim, marginTop: 4, letterSpacing: 0.3, opacity: 0.85 }}>{s}</Text>
                </View>
              </BlurView>
            );
          })}
        </View>

        </StatsSection>
        <StatsSection id="gradepath" title="Grade pathway" collapsed={collapsed} onToggle={toggleSection}>
        <GlassCard>
          <GradePathway compositions={compositions} sessions={sessions} />
        </GlassCard>

        </StatsSection>
        <StatsSection id="gradetarget" title="Grade target" collapsed={collapsed} onToggle={toggleSection}>
        <GlassCard>
          <GradeTargetCard sessions={sessions} compositions={compositions} />
        </GlassCard>

        </StatsSection>
        <StatsSection id="lessons" title={`Lesson insights (${periodLabel})`} collapsed={collapsed} onToggle={toggleSection}>
        <GlassCard>
          <LessonInsights lessons={lessons || []} sessions={sessions} compositions={compositions} period={period} />
        </GlassCard>

        </StatsSection>
        <StatsSection id="growth" title="Library growth & streak history" collapsed={collapsed} onToggle={toggleSection}>
        <GlassCard>
          <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 0, alignItems: isDesktop ? 'flex-start' : 'stretch' }}>
            <View style={{ flex: isDesktop ? 1 : undefined, paddingRight: isDesktop ? 20 : 0 }}>
              <Label>Library growth</Label>
              <LibraryGrowthChart compositions={compositions} sessions={sessions} lessons={lessons} />
            </View>
            {isDesktop && <View style={{ width: 1, backgroundColor: COLOURS.glassBorderSubtle, alignSelf: 'stretch', marginHorizontal: 4 }} />}
            <View style={{ flex: isDesktop ? 1 : undefined, paddingLeft: isDesktop ? 20 : 0, marginTop: isDesktop ? 0 : 16 }}>
              <Label>Streak history ({periodLabel})</Label>
              <StreakHistory sessions={periodSessions} />
            </View>
          </View>
        </GlassCard>

        </StatsSection>
        <StatsSection id="top" title={`Most practised & wins (${periodLabel})`} collapsed={collapsed} onToggle={toggleSection}>
        <GlassCard>
          <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 0, alignItems: isDesktop ? 'flex-start' : 'stretch' }}>
            <View style={{ flex: isDesktop ? 1 : undefined, paddingRight: isDesktop ? 20 : 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Label style={{ marginBottom: 0 }}>Most practised</Label>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[{ key: 'count', label: 'Sessions' }, { key: 'time', label: 'Time' }].map(opt => {
                    const active = pieceSort === opt.key;
                    return (
                      <TouchableOpacity key={opt.key} onPress={() => setPieceSort(opt.key)} activeOpacity={0.75}
                        hitSlop={HIT_PILL} style={{ ...TOUCH_PILL,
                          paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill,
                          backgroundColor: active ? COLOURS.navy : COLOURS.w(0.55),
                          shadowColor: active ? COLOURS.glassShadowMd : COLOURS.glassShadow,
                          shadowOffset: { width: 0, height: active ? 2 : 1 },
                          shadowOpacity: 1, shadowRadius: active ? 6 : 3, elevation: active ? 2 : 1,
                        }}>
                        <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: SIZES.labelSmall, color: active ? COLOURS.onNavy : COLOURS.textMuted }}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              {activePieces.length > 0 ? activePieces.map(({ name, count, avgLiking, avgEnergy, avgSessionEnjoyment, avgDifficulty, mins }) => (
                <View key={name} style={{
                  marginBottom: 12,
                  paddingLeft: 12,
                  borderLeftWidth: 2,
                  borderLeftColor: COLOURS.steel,
                  paddingBottom: 4,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.text, flex: 1 }}>📜 {name}</Text>
                    <View style={{ alignItems: 'flex-end', gap: 1 }}>
                      <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.textDim }}>
                        {pieceSort === 'time' ? timeStr(mins) : `${count}×`}
                      </Text>
                      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>
                        {pieceSort === 'time' ? `${count}× sessions` : (mins > 0 ? `⏱ ${timeStr(mins)}` : '')}
                      </Text>
                    </View>
                  </View>
                  <View style={{ height: 3, backgroundColor: COLOURS.bg2, borderRadius: 2, marginBottom: 8 }}>
                    <View style={{ height: '100%', width: `${((pieceSort === 'time' ? mins : count) / activePieceMax) * 100}%`, backgroundColor: COLOURS.steel, borderRadius: 2 }} />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>Session</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {avgEnergy !== null && <ZeldaBarFractional emoji="⚡" fill={avgEnergy + 3} size={12} />}
                        {avgSessionEnjoyment !== null && <ZeldaBarFractional emoji="❤️" fill={avgSessionEnjoyment} size={12} />}
                      </View>
                    </View>
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>Piece</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {avgLiking !== null && <ZeldaBarFractional emoji="⭐" fill={avgLiking} size={12} />}
                        {avgDifficulty !== null && <ZeldaBarFractional emoji="🎵" fill={avgDifficulty} size={12} />}
                      </View>
                    </View>
                  </View>
                </View>
              )) : (
                <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>No repertoire logged in this period.</Text>
              )}
            </View>
            {isDesktop && <View style={{ width: 1, backgroundColor: COLOURS.glassBorderSubtle, alignSelf: 'stretch', marginHorizontal: 4 }} />}
            <View style={{ flex: isDesktop ? 1 : undefined, paddingLeft: isDesktop ? 20 : 0, marginTop: isDesktop ? 0 : 16 }}>
              <Label>Wins</Label>
              <WinsTimeline sessions={sessions} period={period} />
              <View style={{ height: 1, backgroundColor: COLOURS.glassBorderSubtle, marginVertical: 14 }} />
              <Label>Needs attention</Label>
              <NeglectedPieces sessions={sessions} compositions={compositions} />
              <View style={{ height: 1, backgroundColor: COLOURS.glassBorderSubtle, marginVertical: 14 }} />
              <Label>Scales to revisit</Label>
              <StaleScales sessions={sessions} />
            </View>
          </View>
        </GlassCard>
        </StatsSection>
        </>)}

      </ScrollView>
    <PieceDetailModal
      visible={!!openPiece}
      piece={openPiece}
      sessions={sessions}
      lessons={lessons || []}
      examDate={examDate}
      onSavePiece={onSaveComposition}
      onClose={() => setOpenPieceId(null)}
    />
    </SafeAreaView>
  );
}
