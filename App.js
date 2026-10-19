import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Lato_300Light,
  Lato_400Regular,
  Lato_700Bold,
} from '@expo-google-fonts/lato';

import './src/components/EmojiIcons'; // draws emoji as icons inside <Text> (must load before any screen renders)
import { useSessions, useCompositions, useLessons } from './src/db/hooks';
import { backfillTechniqueGroups } from './src/db/migrations';
import { deriveCompositionStatus, initPrefs, getLocalPref, setLocalPref, todayISO } from './src/utils';
import * as Haptics from 'expo-haptics';
import { notify } from './src/utils/notify';
import { detectMilestones } from './src/utils/progress';
import { setupUpdatePrompt } from './src/utils/updatePrompt';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import CompositionsScreen from './src/screens/CompositionsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import StatsScreen from './src/screens/StatsScreen';
import TimelineScreen from './src/screens/TimelineScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AboutScreen from './src/screens/AboutScreen';
import { AppBackground } from './src/components/Background';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { Sidebar, SIDEBAR_W } from './src/components/Sidebar';
import { CustomTabBar } from './src/components/CustomTabBar';
import { NavScrollProvider } from './src/context/NavScrollContext';
import { useLayout } from './src/utils/useLayout';
import { useUndoableDelete } from './src/components/Undo';
import { COLOURS, live } from './src/theme';
import { ThemeProvider, useTheme, takeResumeRoute } from './src/theme/ThemeContext';

const Tab = createBottomTabNavigator();

const isStandalone =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );

function AppInner({ fontsLoaded }) {
  const { resolved } = useTheme();
  // After a theme change the visual tree remounts; land back on the tab the switch lives on.
  const resumeRoute = useMemo(() => takeResumeRoute() || 'Home', [resolved]);
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!fontsLoaded) return undefined;
    let alive = true;
    let t;
    // Preferences load first (native has no synchronous storage), so onboarding and every
    // remembered choice are known before the first screen renders.
    initPrefs().then(() => {
      if (!alive) return;
      // Web used to store this under a bare 'onboarding_done' key; honour it so existing
      // users aren't shown onboarding again.
      const legacyWeb = typeof localStorage !== 'undefined' && localStorage.getItem('onboarding_done');
      if (!legacyWeb && getLocalPref('onboarding_done') !== '1') setShowOnboarding(true);
      t = setTimeout(() => setReady(true), 200);
    });
    return () => { alive = false; clearTimeout(t); };
  }, [fontsLoaded]);

  function completeOnboarding() {
    setLocalPref('onboarding_done', '1');
    setShowOnboarding(false);
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // This effect runs after React mounts, which can be after the window's `load` event has
      // already fired; waiting for `load` alone would then never register the worker at all.
      const register = () => navigator.serviceWorker.register('/service-worker.js').catch(() => {});
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register);
      setupUpdatePrompt(); // offers a Reload when a new version has been deployed
    }
  }, []);

  const { sessions: allSessions, save: saveSession, remove: removeSession, reload: reloadSessions, loading: sessionsLoading } = useSessions();
  const { compositions: allCompositions, save: saveComp, remove: removeComp, loading: compsLoading }   = useCompositions();
  const { lessons: allLessons, save: saveLesson, remove: removeLesson, loading: lessonsLoading }    = useLessons();
  const { width, onLayout, isDesktop }                         = useLayout();

  // Deletes are undoable app-wide: the item disappears at once but is only really
  // deleted when the undo window closes. Every screen below sees the filtered lists,
  // so swipe-delete, in-card Delete buttons and the detail modals all behave the same.
  // On mobile the toast sits above the add button so the two never overlap.
  const undo = useUndoableDelete({
    bottom: isDesktop ? 24 : Platform.OS === 'web' ? 170 : Platform.OS === 'ios' ? 210 : 190,
  });
  const sessions     = useMemo(() => (allSessions || []).filter(s => !undo.isPending(s.id)), [allSessions, undo.pending]);
  const lessons      = useMemo(() => (allLessons || []).filter(l => !undo.isPending(l.id)), [allLessons, undo.pending]);
  const compositions = useMemo(() => (allCompositions || []).filter(c => !undo.isPending(c.id)), [allCompositions, undo.pending]);
  const deleteSession = id => undo.schedule(id, 'Session', () => removeSession(id));
  const deleteLesson  = id => undo.schedule(id, 'Lesson',  () => removeLesson(id));
  const deleteComp    = id => undo.schedule(id, 'Piece',   () => removeComp(id));

  // Saves made through the UI give feedback: a light success haptic on native, and a short
  // message when the save newly reaches a milestone (first session, a 7-day streak, 10 hours…).
  // Bulk paths (import / sync in Settings) keep the raw savers below, so restoring a backup
  // doesn't fire a stack of celebrations.
  const pulse = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };
  const announce = found => { if (found[0]) notify(found[0].title, found[0].message); };
  const saveSessionUI = async s => {
    const isNew = !allSessions.some(x => x.id === s.id);
    const result = await saveSession(s);
    pulse();
    if (isNew) {
      announce(detectMilestones(
        { sessions: allSessions, lessons: allLessons },
        { sessions: [...allSessions, s], lessons: allLessons },
        todayISO(),
      ));
    }
    return result;
  };
  const saveLessonUI = async l => {
    const isNew = !allLessons.some(x => x.id === l.id);
    const result = await saveLesson(l);
    pulse();
    if (isNew) {
      announce(detectMilestones(
        { sessions: allSessions, lessons: allLessons },
        { sessions: allSessions, lessons: [...allLessons, l] },
        todayISO(),
      ));
    }
    return result;
  };

  // One-time data fix, see migrations.js for why. Runs once this session is
  // ready to render and refreshes the sessions list if it touched anything,
  // so the fix is visible immediately rather than needing a relaunch.
  useEffect(() => {
    if (!ready) return;
    backfillTechniqueGroups().then(reloadSessions);
  }, [ready, reloadSessions]);

  // Status is derived, not stored — computed once here from sessions/lessons
  // and threaded through as `compositions` to every screen below, so no
  // screen needs its own logic to resolve it.
  const compositionsWithStatus = useMemo(
    () => compositions.map(c => ({ ...c, status: deriveCompositionStatus(c.id, sessions, lessons, c.shelvedAt) })),
    [compositions, sessions, lessons]
  );

  // Desktop: manage active tab ourselves (no React Navigation tab bar)
  const [activeTab, setActiveTab] = useState('Home');

  // Keep the splash up until the local data has loaded. Without this Home drew with no sessions for a
  // moment and flashed its "journal starts here" message before the real entries popped in. The wait
  // is capped, so a storage problem can never leave you stuck on the splash.
  const [dataWaited, setDataWaited] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDataWaited(true), 4000);
    return () => clearTimeout(t);
  }, []);
  const dataLoading = (sessionsLoading || compsLoading || lessonsLoading) && !dataWaited;

  if (!fontsLoaded || !ready || dataLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLOURS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'serif', fontSize: 28, color: COLOURS.navy, fontStyle: 'italic', letterSpacing: -0.5 }}>
          music<Text style={{ color: COLOURS.practiceText }}>.</Text>
          <Text style={{ color: COLOURS.lessonText }}>log</Text>
        </Text>
      </View>
    );
  }

  if (showOnboarding && !(Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth >= 768)) {
    return (
      <>
        <StatusBar style={COLOURS.statusBar} backgroundColor={COLOURS.bg} translucent={false} />
        <View style={{ flex: 1 }}>
          <AppBackground />
          {/* A translucent status bar draws the page behind the notch, so keep the content clear of it. */}
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <OnboardingScreen onComplete={completeOnboarding} />
          </SafeAreaView>
        </View>
      </>
    );
  }

  const screenProps = {
    sessions, lessons, compositions: compositionsWithStatus,
    onSave: saveSessionUI, onSaveLesson: saveLessonUI,
    onDelete: deleteSession, onDeleteLesson: deleteLesson,
    isDesktop,
  };

  // ── Desktop layout: sidebar + content ──────────────────────────────────────
  if (Platform.OS === 'web' && isDesktop) {
    const renderScreen = () => {
      switch (activeTab) {
        case 'Home':     return <HomeScreen     key="home"     {...screenProps} onOpenSettings={() => setActiveTab('Settings')} />;
        case 'Calendar': return <CalendarScreen key="calendar" {...screenProps} />;
        case 'Pieces':   return <CompositionsScreen key="pieces" compositions={compositionsWithStatus} sessions={sessions} onSave={saveComp} onDelete={deleteComp} isDesktop={isDesktop} />;
        case 'History':  return <HistoryScreen  key="history"  sessions={sessions} lessons={lessons} compositions={compositionsWithStatus} onDelete={deleteSession} onDeleteLesson={deleteLesson} isDesktop={isDesktop} />;
        case 'Stats':    return <StatsScreen    key="stats"    sessions={sessions} compositions={compositionsWithStatus} lessons={lessons} isDesktop={isDesktop} />;
        case 'Timeline': return <TimelineScreen key="timeline" compositions={compositionsWithStatus} sessions={sessions} lessons={lessons} isDesktop={isDesktop} />;
        case 'Settings': return <SettingsScreen key="settings" isDesktop={isDesktop} sessions={sessions} lessons={lessons} compositions={compositions} onSaveSession={saveSession} onSaveLesson={saveLesson} onSaveComposition={saveComp} />;
        case 'About':    return <AboutScreen    key="about"    isDesktop={isDesktop} />;
        default:         return <HomeScreen     key="home"     {...screenProps} onOpenSettings={() => setActiveTab('Settings')} />;
      }
    };

    return (
      <>
        <StatusBar style={COLOURS.statusBar} backgroundColor={COLOURS.bg} translucent={false} />
        <View key={resolved} style={styles.desktopOuter} onLayout={onLayout}>
          <AppBackground />
          <View style={styles.desktopLayout}>
            <Sidebar activeTab={activeTab} onNavigate={setActiveTab} />
            <View style={styles.desktopContent}>
              {renderScreen()}
            </View>
          </View>
          {showOnboarding && <OnboardingScreen onComplete={completeOnboarding} />}
          {undo.toast}
        </View>
      </>
    );
  }

  // ── Mobile layout: bottom tab navigator ────────────────────────────────────
  const mobileContent = (
    <NavScrollProvider>
    <View key={resolved} style={{ flex: 1, backgroundColor: COLOURS.bg }} onLayout={onLayout}>
      <AppBackground />
      <NavigationContainer
        theme={{
          dark: COLOURS.isDark,
          colors: {
            primary:      COLOURS.navy,
            background:   COLOURS.bg,
            card:         'rgba(234,240,245,0.92)',
            text:         COLOURS.text,
            border:       COLOURS.glassBorder,
            notification: COLOURS.pink,
          },
        }}
      >
        <Tab.Navigator
          initialRouteName={resumeRoute}
          sceneContainerStyle={{ backgroundColor: 'transparent' }}
          tabBar={props => <CustomTabBar {...props} />}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tab.Screen name="Home">
            {({ navigation }) => <HomeScreen     {...screenProps} onOpenSettings={() => navigation.navigate('Settings')} />}
          </Tab.Screen>
          <Tab.Screen name="Calendar">
            {() => <CalendarScreen {...screenProps} />}
          </Tab.Screen>
          <Tab.Screen name="History">
            {() => <HistoryScreen sessions={sessions} lessons={lessons} compositions={compositionsWithStatus} onDelete={deleteSession} onDeleteLesson={deleteLesson} isDesktop={false} />}
          </Tab.Screen>
          <Tab.Screen name="Pieces">
            {({ navigation }) => <CompositionsScreen compositions={compositionsWithStatus} sessions={sessions} onSave={saveComp} onDelete={deleteComp} isDesktop={false} onOpenTimeline={() => navigation.navigate('Timeline')} />}
          </Tab.Screen>
          <Tab.Screen name="Stats">
            {() => <StatsScreen sessions={sessions} compositions={compositionsWithStatus} lessons={lessons} isDesktop={false} />}
          </Tab.Screen>
          <Tab.Screen name="Timeline">
            {() => <TimelineScreen compositions={compositionsWithStatus} sessions={sessions} lessons={lessons} isDesktop={false} />}
          </Tab.Screen>
          <Tab.Screen name="Settings">
            {() => <SettingsScreen isDesktop={false} sessions={sessions} lessons={lessons} compositions={compositions} onSaveSession={saveSession} onSaveLesson={saveLesson} onSaveComposition={saveComp} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
      {undo.toast}
    </View>
    </NavScrollProvider>
  );

  return (
    <>
      <StatusBar style={COLOURS.statusBar} backgroundColor={COLOURS.bg} translucent={false} />
      {Platform.OS === 'web' ? (
        isStandalone ? (
          <View style={styles.webStandalone}>{mobileContent}</View>
        ) : (
          <View style={styles.webOuter} onLayout={onLayout}>
            <View style={styles.webInner}>{mobileContent}</View>
          </View>
        )
      ) : mobileContent}
    </>
  );
}

// Inside the provider so the theme is applied before anything reads COLOURS, and
// subscribed to it so the safe-area background follows a theme change.
function Root({ fontsLoaded }) {
  useTheme();
  return (
    <SafeAreaProvider style={{ backgroundColor: COLOURS.bg }}>
      <AppInner fontsLoaded={fontsLoaded} />
    </SafeAreaProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'CormorantGaramond':            CormorantGaramond_400Regular,
    'CormorantGaramond-Italic':     CormorantGaramond_400Regular_Italic,
    'CormorantGaramond-Bold':       CormorantGaramond_600SemiBold,
    'CormorantGaramond-BoldItalic': CormorantGaramond_600SemiBold_Italic,
    'Lato-Light':                   Lato_300Light,
    'Lato':                         Lato_400Regular,
    'Lato-Bold':                    Lato_700Bold,
  });

  return (
    <ThemeProvider>
      <Root fontsLoaded={fontsLoaded} />
    </ThemeProvider>
  );
}

const styles = live(() => StyleSheet.create({
  // Mobile web
  webOuter:       { flex: 1, backgroundColor: COLOURS.bg, alignItems: 'center' },
  webInner:       { flex: 1, width: '100%', maxWidth: 520, overflow: 'hidden' },
  webStandalone:  { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: COLOURS.bg },
  // Desktop
  desktopOuter:   { flex: 1, backgroundColor: COLOURS.bg },
  desktopLayout:  { flex: 1, flexDirection: 'row', alignItems: 'stretch', position: 'relative' },
  desktopContent: { flex: 1, overflow: 'hidden' },
}));
