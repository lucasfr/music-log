import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  LibreBaskerville_400Regular,
  LibreBaskerville_400Regular_Italic,
  LibreBaskerville_700Bold,
} from '@expo-google-fonts/libre-baskerville';
import {
  SourceSans3_400Regular,
  SourceSans3_400Regular_Italic,
  SourceSans3_700Bold,
} from '@expo-google-fonts/source-sans-3';

import { useSessions, useCompositions } from './src/db/hooks';
import HomeScreen from './src/screens/HomeScreen';
import CompositionsScreen from './src/screens/CompositionsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import StatsScreen from './src/screens/StatsScreen';
import { AppBackground } from './src/components/Background';
import { COLOURS } from './src/theme';

const Tab = createBottomTabNavigator();

const ICONS = { Home: '◈', Pieces: '♩', History: '◷', Stats: '▦' };

function TabIcon({ name, color, size }) {
  return (
    <Text style={{ fontSize: size * 0.82, color, lineHeight: size, textAlign: 'center' }}>
      {ICONS[name] || '·'}
    </Text>
  );
}

function TabLabel({ label, focused }) {
  return (
    <Text style={{
      fontSize: 11,
      fontWeight: focused ? '600' : '400',
      color: focused ? COLOURS.navy : COLOURS.textDim,
      marginBottom: 2,
    }}>
      {label}
    </Text>
  );
}

if (Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'LibreBaskerville':        LibreBaskerville_400Regular,
    'LibreBaskerville-Italic': LibreBaskerville_400Regular_Italic,
    'LibreBaskerville-Bold':   LibreBaskerville_700Bold,
    'SourceSans3':             SourceSans3_400Regular,
    'SourceSans3-Italic':      SourceSans3_400Regular_Italic,
    'SourceSans3-Bold':        SourceSans3_700Bold,
  });

  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (fontsLoaded) {
      const t = setTimeout(() => setReady(true), 200);
      return () => clearTimeout(t);
    }
  }, [fontsLoaded]);

  const { sessions, save: saveSession, remove: deleteSession } = useSessions();
  const { compositions, save: saveComp, remove: deleteComp } = useCompositions();

  if (!fontsLoaded || !ready) {
    return (
      <View style={{ flex: 1, backgroundColor: COLOURS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'serif', fontSize: 28, color: COLOURS.navy, fontStyle: 'italic', letterSpacing: -0.5 }}>
          music.log
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
              backgroundColor: 'rgba(234,240,245,0.92)',
              borderTopColor:  COLOURS.glassBorder,
              borderTopWidth:  1,
              paddingBottom:   Platform.OS === 'ios' ? 2 : 4,
            },
            tabBarLabel: ({ focused }) => (
              <TabLabel label={route.name} focused={focused} />
            ),
            tabBarIcon: ({ color, size }) => (
              <TabIcon name={route.name} color={color} size={size} />
            ),
          })}
        >
          <Tab.Screen name="Home">
            {() => (
              <HomeScreen
                sessions={sessions}
                compositions={compositions}
                onSave={saveSession}
                onDelete={deleteSession}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Pieces">
            {() => <CompositionsScreen compositions={compositions} sessions={sessions} onSave={saveComp} onDelete={deleteComp} />}
          </Tab.Screen>
          <Tab.Screen name="History">
            {() => <HistoryScreen sessions={sessions} compositions={compositions} onDelete={deleteSession} />}
          </Tab.Screen>
          <Tab.Screen name="Stats">
            {() => <StatsScreen sessions={sessions} compositions={compositions} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </View>
  );

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {Platform.OS === 'web' ? (
        <View style={styles.webOuter}>
          <View style={styles.webInner}>{content}</View>
        </View>
      ) : content}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webOuter: { flex: 1, backgroundColor: COLOURS.bg, alignItems: 'center' },
  webInner: { flex: 1, width: '100%', maxWidth: 520, overflow: 'hidden' },
});
