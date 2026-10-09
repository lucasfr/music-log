import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLOURS, RADIUS } from '../theme';
import { useNavScrollContext } from '../context/NavScrollContext';

const TAB_ICONS = {
  Home:     { active: 'home',          inactive: 'home-outline' },
  Calendar: { active: 'calendar',      inactive: 'calendar-outline' },
  History:  { active: 'time',          inactive: 'time-outline' },
  Pieces:   { active: 'musical-notes', inactive: 'musical-notes-outline' },
  Stats:    { active: 'bar-chart',     inactive: 'bar-chart-outline' },
  Timeline: { active: 'git-branch',    inactive: 'git-branch-outline' },
  Settings: { active: 'settings',      inactive: 'settings-outline' },
};

// Reachable via navigation.navigate elsewhere if needed, but doesn't get
// a permanent slot in the floating pill — keeps the bar from feeling crowded.
const HIDDEN_ROUTES = ['Timeline'];

const ICON_SIZE = 44;
const ICON_GAP  = 4;
// The active tab shows its name under the icon, so it's wider and a little taller.
const LABEL_W   = 58;
const TAB_LABELS = {
  Home: 'Home', Calendar: 'Calendar', History: 'History', Pieces: 'Pieces',
  Stats: 'Stats', Timeline: 'Timeline', Settings: 'Settings',
};

export function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { compact } = useNavScrollContext();

  const visibleRoutes = state.routes.filter(r => !HIDDEN_ROUTES.includes(r.name));
  const expandedWidth = visibleRoutes.length * ICON_SIZE + (visibleRoutes.length - 1) * ICON_GAP + 24 + (LABEL_W - ICON_SIZE);
  const widthAnim = useRef(new Animated.Value(expandedWidth)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: compact ? LABEL_W + 24 : expandedWidth,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [compact, expandedWidth, widthAnim]);

  return (
    <View
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        alignItems: 'center',
        paddingBottom: Platform.OS === 'web' ? 20 : (insets.bottom || 12),
      }}
      pointerEvents="box-none"
    >
      <Animated.View
        style={{
          width: widthAnim,
          height: ICON_SIZE + 16,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: ICON_GAP,
          paddingHorizontal: 12,
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderRadius: RADIUS.pill,
          shadowColor: COLOURS.glassShadowMd,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 18,
          elevation: 10,
          overflow: 'hidden',
        }}
      >
        {visibleRoutes.map(route => {
          const routeIndex = state.routes.findIndex(r => r.key === route.key);
          const focused = state.index === routeIndex;
          if (compact && !focused) return null;
          const icons = TAB_ICONS[route.name] || { active: 'ellipse', inactive: 'ellipse-outline' };
          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityLabel={TAB_LABELS[route.name] || route.name}
              accessibilityState={{ selected: focused }}
              style={{
                width: focused ? LABEL_W : ICON_SIZE,
                height: focused ? ICON_SIZE + 8 : ICON_SIZE,
                borderRadius: focused ? 22 : ICON_SIZE / 2,
                backgroundColor: focused ? COLOURS.navy : 'rgba(9,99,126,0.10)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons
                name={focused ? icons.active : icons.inactive}
                size={20}
                color={focused ? '#ffffff' : COLOURS.textDim}
              />
              {focused ? (
                <Text numberOfLines={1} style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: '#fff', marginTop: 1 }}>
                  {TAB_LABELS[route.name] || route.name}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}
