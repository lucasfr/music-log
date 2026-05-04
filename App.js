import React from 'react';
import { View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useSessions, useCompositions } from './src/db/hooks';
import LogScreen from './src/screens/LogScreen';
import CompositionsScreen from './src/screens/CompositionsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import StatsScreen from './src/screens/StatsScreen';
import { COLORS_LIGHT, COLORS_DARK } from './src/theme';

const Tab = createBottomTabNavigator();

function TabIcon({ name, focused, color }) {
  const icons = { Log: '✎', Pieces: '♩', History: '◷', Stats: '▦' };
  return <Text style={{ fontSize: 18, color }}>{icons[name] || '·'}</Text>;
}

export default function App() {
  const scheme = useColorScheme();
  const C = scheme === 'dark' ? COLORS_DARK : COLORS_LIGHT;

  const { sessions, save: saveSession, remove: deleteSession } = useSessions();
  const { compositions, save: saveComp, remove: deleteComp } = useCompositions();

  const navTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: C.surface,
      card: C.card,
      border: C.border,
      primary: C.accent,
      text: C.ink,
    },
  };

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: C.accent,
            tabBarInactiveTintColor: C.ink3,
            tabBarStyle: {
              backgroundColor: C.card,
              borderTopColor: C.border,
              borderTopWidth: 1,
              paddingBottom: 4,
            },
            tabBarLabelStyle: { fontSize: 11 },
            tabBarIcon: ({ focused, color }) => (
              <TabIcon name={route.name} focused={focused} color={color} />
            ),
          })}
        >
          <Tab.Screen name="Log">
            {() => <LogScreen sessions={sessions} compositions={compositions} onSave={saveSession} />}
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
    </SafeAreaProvider>
  );
}
