import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { AppBackground } from './src/components/Background';
import { COLOURS } from './src/theme';

const Tab = createBottomTabNavigator();

// ─── Tab icons — Ionicons on navy rounded square ───────────────────────────

const TAB_ICONS = {
  Home:     { active: 'home',          inactive: 'home-outline' },
  Calendar: { active: 'calendar',      inactive: 'calendar-outline' },
  Pieces:   { active: 'musical-notes', inactive: 'musical-notes-outline' },
  Stats:    { active: 'bar-chart',     inactive: 'bar-chart-outline' },
};

function TabIcon({ name, focused, size }) {
  const icons  = TAB_ICONS[name] || { active: 'ellipse', inactive: 'ellipse-outline' };
  const icon   = focused ? icons.active : icons.inactive;
  const bgSize = size + 8;
  return (
    <View style={{
      width: bgSize, height: bgSize,
      borderRadius: bgSize * 0.28,
      backgroundColor: focused ? COLOURS.navy : 'rgba(9,99,126,0.12)',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Ionicons name={icon} size={size * 0.82} color="#ffffff" />
    </View>
  );
}

function TabLabel({ label, focused }) {
  return (
    <Text style={{
      fontSize: 11,
      fontFamily: 'Lato-Bold',
      color: focused ? COLOURS.navy : COLOURS.textDim,
      marginBottom: 2,
    }}>
      {label}
    </Text>
  );
}

const isStandalone =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );

export default function App() {
  const [fontsLoaded] = useFonts({
    'CormorantGaramond':             CormorantGaramond_400Regular,
    'CormorantGaramond-Italic':      CormorantGaramond_400Regular_Italic,
    'CormorantGaramond-Bold':        CormorantGaramond_600SemiBold,
    'CormorantGaramond-BoldItalic':  CormorantGaramond_600SemiBold_Italic,
    'Lato-Light':                    Lato_300Light,
    'Lato':                          Lato_400Regular,
    'Lato-Bold':                     Lato_700Bold,
  });

  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (fontsLoaded) {
      const t = setTimeout(() => setReady(true), 200);
      return () => clearTimeout(t);
    }
  }, [fontsLoaded]);

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

  if (!fontsLoaded || !ready) {
    return (
      <View style={{ flex: 1, backgroundColor: COLOURS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'serif', fontSize: 28, color: COLOURS.navy, fontStyle: 'italic', letterSpacing: -0.5 }}>
          music<Text style={{ color: COLOURS.practiceText }}>.</Text><Text style={{ color: COLOURS.lessonText }}>log</Text>
        </Text>
      </View>
    );
  }

  const content = (
    <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
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
              height: Platform.OS === 'web' ? 92 : 72 + (Platform.OS === 'ios' ? 20 : 0),
              paddingTop: 10,
              paddingBottom: Platform.OS === 'web' ? 20 : Platform.OS === 'ios' ? 20 : 8,
              shadowColor: COLOURS.glassShadow,
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 1,
              shadowRadius: 16,
              elevation: 10,
            },
            tabBarLabel: ({ focused }) => (
              <TabLabel label={route.name} focused={focused} />
            ),
            tabBarIcon: ({ focused, size }) => (
              <TabIcon name={route.name} focused={focused} size={size} />
            ),
          })}
        >
          <Tab.Screen name="Home">
            {() => (
              <HomeScreen
                sessions={sessions}
                lessons={lessons}
                compositions={compositions}
                onSave={saveSession}
                onSaveLesson={saveLesson}
                onDelete={deleteSession}
                onDeleteLesson={deleteLesson}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Calendar">
            {() => (
              <CalendarScreen
                sessions={sessions}
                lessons={lessons}
                compositions={compositions}
                onSave={saveSession}
                onSaveLesson={saveLesson}
                onDelete={deleteSession}
                onDeleteLesson={deleteLesson}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Pieces">
            {() => <CompositionsScreen compositions={compositions} sessions={sessions} onSave={saveComp} onDelete={deleteComp} />}
          </Tab.Screen>
          <Tab.Screen name="Stats">
            {() => <StatsScreen sessions={sessions} compositions={compositions} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </View>
  );

  return (
    <SafeAreaProvider style={{ backgroundColor: COLOURS.bg }}>
      <StatusBar style="dark" backgroundColor={COLOURS.bg} translucent={false} />
      {Platform.OS === 'web' ? (
        isStandalone ? (
          <View style={styles.webStandalone}>{content}</View>
        ) : (
          <View style={styles.webOuter}>
            <View style={styles.webInner}>{content}</View>
          </View>
        )
      ) : content}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webOuter:      { flex: 1, backgroundColor: COLOURS.bg, alignItems: 'center' },
  webInner:      { flex: 1, width: '100%', maxWidth: 520, overflow: 'hidden' },
  webStandalone: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: COLOURS.bg },
});
