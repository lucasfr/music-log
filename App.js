import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
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

// ─── Tab icons — white SVG on navy rounded square ───────────────────────────

function TabIcon({ name, focused, size }) {
  const bg     = focused ? COLOURS.navy : 'rgba(9,99,126,0.18)';
  const stroke = '#ffffff';
  const r      = size * 0.22; // corner radius
  const p      = size * 0.24; // inner padding
  const inner  = size - p * 2;

  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
        {name === 'Home' && (
          <>
            <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" />
            <Path d="M9 21V12h6v9" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {name === 'Calendar' && (
          <>
            <Rect x="3" y="4" width="18" height="17" rx="2" stroke={stroke} strokeWidth={1.8} />
            <Path d="M3 9h18" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
            <Path d="M8 2v3M16 2v3" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
            <Path d="M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
          </>
        )}
        {name === 'Pieces' && (
          <>
            <Path d="M4 6h16M4 10h16M4 14h10" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
            <Circle cx="17" cy="17" r="3" stroke={stroke} strokeWidth={1.6} />
            <Path d="M19.5 19.5L22 22" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
          </>
        )}
        {name === 'Stats' && (
          <>
            <Path d="M4 20V14" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
            <Path d="M9 20V8" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
            <Path d="M14 20V12" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
            <Path d="M19 20V5" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
          </>
        )}
      </Svg>
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
