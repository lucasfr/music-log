import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from './Icon';
import { Pop } from './Motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLOURS, RADIUS } from '../theme';
import { useNavScrollContext } from '../context/NavScrollContext';
import { useSyncIssue } from '../db/useSyncIssue';
import { tabBarLayout } from '../utils/tabBarLayout';

const TAB_ICONS = {
  Home:     { active: 'home',          inactive: 'home-outline' },
  Calendar: { active: 'calendar',      inactive: 'calendar-outline' },
  History:  { active: 'history',       inactive: 'history' },
  Pieces:   { active: 'musical-notes', inactive: 'musical-notes-outline' },
  Stats:    { active: 'bar-chart',     inactive: 'bar-chart-outline' },
  Timeline: { active: 'git-branch',    inactive: 'git-branch-outline' },
  Settings: { active: 'settings',      inactive: 'settings-outline' },
};

// Has no permanent slot in the floating pill, which keeps the bar from feeling crowded. It's
// reached from the Pieces screen, and shows in the pill while you're on it so you can see where
// you are (and tap Pieces to go back).
const HIDDEN_ROUTES = ['Timeline'];

const ICON_SIZE = 44;
const ICON_GAP  = 4;
// The active tab shows its name under the icon, so it's wider and a little taller.
const LABEL_W   = 58;
const TAB_LABELS = {
  Home: 'Home', Calendar: 'Calendar', History: 'History', Pieces: 'Pieces',
  Stats: 'Stats', Timeline: 'Timeline', Settings: 'Settings',
};

// Collapsed, the pill hugs the active tab with just a thin rim (it used to keep the full
// 12px of padding either side, which read as a heavy dark capsule on top of the content).
const COMPACT_RIM = 4;

export function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { compact } = useNavScrollContext();
  const { width: screenWidth } = useWindowDimensions();
  // A sync problem that needs attention puts a dot on the Settings tab (never for being offline).
  const syncProblem = useSyncIssue();

  const visibleRoutes = state.routes.filter((r, i) => !HIDDEN_ROUTES.includes(r.name) || state.index === i);
  // Seven tabs (Timeline showing) are wider than a small phone, so the gaps and end padding give way.
  const layout = tabBarLayout(visibleRoutes.length, screenWidth, { icon: ICON_SIZE, label: LABEL_W, gap: ICON_GAP });
  const expandedWidth = layout.width;
  const widthAnim = useRef(new Animated.Value(expandedWidth)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: compact ? LABEL_W + COMPACT_RIM * 2 : expandedWidth,
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
          gap: compact ? ICON_GAP : layout.gap,
          paddingHorizontal: compact ? COMPACT_RIM : layout.pad,
          backgroundColor: COLOURS.float,
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
              accessibilityLabel={(TAB_LABELS[route.name] || route.name) + (route.name === 'Settings' && syncProblem ? ', sync problem' : '')}
              accessibilityState={{ selected: focused }}
              style={{
                width: focused ? LABEL_W : ICON_SIZE,
                height: focused ? ICON_SIZE + 8 : ICON_SIZE,
                borderRadius: focused ? 22 : ICON_SIZE / 2,
                backgroundColor: focused ? COLOURS.navy : COLOURS.navyA(0.10),
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {/* The icon springs up when its tab becomes the active one. */}
              <Pop trigger={focused} playOnMount>
                <Ionicons
                  name={focused ? icons.active : icons.inactive}
                  size={20}
                  color={focused ? '#ffffff' : COLOURS.textDim}
                />
              </Pop>
              {route.name === 'Settings' && syncProblem ? (
                <View pointerEvents="none" style={{
                  position: 'absolute', top: focused ? 7 : 6, right: focused ? 12 : 8,
                  width: 10, height: 10, borderRadius: 5, backgroundColor: COLOURS.red,
                  borderWidth: 2, borderColor: focused ? COLOURS.navy : COLOURS.float,
                }} />
              ) : null}
              {focused ? (
                <Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: '#fff', marginTop: 1 }}>
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
