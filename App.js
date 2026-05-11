import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

import { useSessions, useCompositions, useLessons } from './src/db/hooks';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import CompositionsScreen from './src/screens/CompositionsScreen';
import StatsScreen from './src/screens/StatsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AboutScreen from './src/screens/AboutScreen';
import { AppBackground } from './src/components/Background';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { Sidebar, SIDEBAR_W } from './src/components/Sidebar';
import { useLayout } from './src/utils/useLayout';
import { COLOURS } from './src/theme';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home:     { active: 'home',                inactive: 'home-outline' },
  Calendar: { active: 'calendar',            inactive: 'calendar-outline' },
  Pieces:   { active: 'musical-notes',       inactive: 'musical-notes-outline' },
  Stats:    { active: 'bar-chart',           inactive: 'bar-chart-outline' },
  Settings: { active: 'settings',            inactive: 'settings-outline' },
  About:    { active: 'information-circle',  inactive: 'information-circle-outline' },
};

function TabIcon({ name, focused }) {
  const icons = TAB_ICONS[name] || { active: 'ellipse', inactive: 'ellipse-outline' };
  return (
    <View style={{
      width: 44, height: 44,
      borderRadius: 12,
      backgroundColor: focused ? COLOURS.navy : 'rgba(9,99,126,0.12)',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Ionicons name={focused ? icons.active : icons.inactive} size={24} color="#ffffff" />
    </View>
  );
}

const isStandalone =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );

function AppInner({ fontsLoaded }) {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      const done = Platform.OS === 'web'
        ? localStorage.getItem('onboarding_done')
        : null; // native: always show for now, can add AsyncStorage later
      if (!done) setShowOnboarding(true);
      const t = setTimeout(() => setReady(true), 200);
      return () => clearTimeout(t);
    }
  }, [fontsLoaded]);

  function completeOnboarding() {
    if (Platform.OS === 'web') localStorage.setItem('onboarding_done', '1');
    setShowOnboarding(false);
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(() => {});
      });
    }
  }, []);

  const { sessions, save: saveSession, remove: deleteSession } = useSessions();
  const { compositions, save: saveComp, remove: deleteComp }   = useCompositions();
  const { lessons, save: saveLesson, remove: deleteLesson }    = useLessons();
  const { width, onLayout, isDesktop }                         = useLayout();

  // Desktop: manage active tab ourselves (no React Navigation tab bar)
  const [activeTab, setActiveTab] = useState('Home');

  if (!fontsLoaded || !ready) {
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
        <StatusBar style="dark" backgroundColor={COLOURS.bg} translucent={false} />
        <View style={{ flex: 1 }}>
          <AppBackground />
          <OnboardingScreen onComplete={completeOnboarding} />
        </View>
      </>
    );
  }

  const screenProps = {
    sessions, lessons, compositions,
    onSave: saveSession, onSaveLesson: saveLesson,
    onDelete: deleteSession, onDeleteLesson: deleteLesson,
    isDesktop,
  };

  // ── Desktop layout: sidebar + content ──────────────────────────────────────
  if (Platform.OS === 'web' && isDesktop) {
    const renderScreen = () => {
      switch (activeTab) {
        case 'Home':     return <HomeScreen     key="home"     {...screenProps} />;
        case 'Calendar': return <CalendarScreen key="calendar" {...screenProps} />;
        case 'Pieces':   return <CompositionsScreen key="pieces" compositions={compositions} sessions={sessions} onSave={saveComp} onDelete={deleteComp} isDesktop={isDesktop} />;
        case 'Stats':    return <StatsScreen    key="stats"    sessions={sessions} compositions={compositions} isDesktop={isDesktop} />;
        case 'Settings': return <SettingsScreen key="settings" isDesktop={isDesktop} sessions={sessions} lessons={lessons} compositions={compositions} onSaveSession={saveSession} onSaveLesson={saveLesson} onSaveComposition={saveComp} />;
        case 'About':    return <AboutScreen    key="about"    isDesktop={isDesktop} />;
        default:         return <HomeScreen     key="home"     {...screenProps} />;
      }
    };

    return (
      <>
        <StatusBar style="dark" backgroundColor={COLOURS.bg} translucent={false} />
        <View style={styles.desktopOuter} onLayout={onLayout}>
          <AppBackground />
          <View style={styles.desktopLayout}>
            <Sidebar activeTab={activeTab} onNavigate={setActiveTab} />
            <View style={styles.desktopContent}>
              {renderScreen()}
            </View>
          </View>
          {showOnboarding && <OnboardingScreen onComplete={completeOnboarding} />}
        </View>
      </>
    );
  }

  // ── Mobile layout: bottom tab navigator ────────────────────────────────────
  const mobileContent = (
    <View style={{ flex: 1, backgroundColor: COLOURS.bg }} onLayout={onLayout}>
      <AppBackground />
      <NavigationContainer
        theme={{
          dark: false,
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
          sceneContainerStyle={{ backgroundColor: 'transparent' }}
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor:   COLOURS.navy,
            tabBarInactiveTintColor: COLOURS.textDim,
            tabBarStyle: {
              backgroundColor: 'rgba(234,240,245,0.95)',
              borderTopWidth: 0,
              position: 'absolute',
              height: Platform.OS === 'web' ? (72 + 20) : (72 + insets.bottom),
              paddingTop: 18,
              paddingBottom: Platform.OS === 'web' ? 20 : (insets.bottom || 8),
              shadowColor: COLOURS.glassShadow,
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 1,
              shadowRadius: 16,
              elevation: 10,
            },
            tabBarShowLabel: false,
            tabBarIcon: ({ focused, size }) => (
              <TabIcon name={route.name} focused={focused} size={size} />
            ),
          })}
        >
          <Tab.Screen name="Home">
            {() => <HomeScreen     {...screenProps} />}
          </Tab.Screen>
          <Tab.Screen name="Calendar">
            {() => <CalendarScreen {...screenProps} />}
          </Tab.Screen>
          <Tab.Screen name="Pieces">
            {() => <CompositionsScreen compositions={compositions} sessions={sessions} onSave={saveComp} onDelete={deleteComp} isDesktop={false} />}
          </Tab.Screen>
          <Tab.Screen name="Stats">
            {() => <StatsScreen sessions={sessions} compositions={compositions} isDesktop={false} />}
          </Tab.Screen>
          <Tab.Screen name="Settings">
            {() => <SettingsScreen isDesktop={false} sessions={sessions} lessons={lessons} compositions={compositions} onSaveSession={saveSession} onSaveLesson={saveLesson} onSaveComposition={saveComp} />}
          </Tab.Screen>
          <Tab.Screen name="About">
            {() => <AboutScreen isDesktop={false} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </View>
  );

  return (
    <>
      <StatusBar style="dark" backgroundColor={COLOURS.bg} translucent={false} />
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
    <SafeAreaProvider style={{ backgroundColor: COLOURS.bg }}>
      <AppInner fontsLoaded={fontsLoaded} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Mobile web
  webOuter:       { flex: 1, backgroundColor: COLOURS.bg, alignItems: 'center' },
  webInner:       { flex: 1, width: '100%', maxWidth: 520, overflow: 'hidden' },
  webStandalone:  { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: COLOURS.bg },
  // Desktop
  desktopOuter:   { flex: 1, backgroundColor: COLOURS.bg },
  desktopLayout:  { flex: 1, flexDirection: 'row', alignItems: 'stretch', position: 'relative' },
  desktopContent: { flex: 1, overflow: 'hidden' },
});
