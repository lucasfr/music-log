import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLOURS, RADIUS } from '../theme';

const SIDEBAR_W = 200;

const NAV_ITEMS = [
  { name: 'Home',     icon: 'home',          iconOut: 'home-outline' },
  { name: 'Calendar', icon: 'calendar',      iconOut: 'calendar-outline' },
  { name: 'Pieces',   icon: 'musical-notes', iconOut: 'musical-notes-outline' },
  { name: 'Stats',    icon: 'bar-chart',     iconOut: 'bar-chart-outline' },
];

export function Sidebar({ activeTab, onNavigate }) {
  return (
    <View style={styles.sidebar}>
      {/* Logo */}
      <View style={styles.logoRow}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logoImg}
        />
        <Text style={styles.logoText}>
          music<Text style={{ color: COLOURS.practiceText }}>.</Text>
          <Text style={{ color: COLOURS.lessonText }}>log</Text>
        </Text>
      </View>

      {/* Nav items */}
      <View style={styles.nav}>
        {NAV_ITEMS.map(item => {
          const active = activeTab === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              onPress={() => onNavigate(item.name)}
              activeOpacity={0.75}
              style={[styles.navItem, active && styles.navItemActive]}
            >
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                <Ionicons
                  name={active ? item.icon : item.iconOut}
                  size={20}
                  color="#ffffff"
                />
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bottom spacer */}
      <View style={{ flex: 1 }} />
    </View>
  );
}

export { SIDEBAR_W };

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_W,
    backgroundColor: 'rgba(9,99,126,0.06)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(9,99,126,0.10)',
    paddingTop: Platform.OS === 'web' ? 24 : 48,
    paddingBottom: 24,
    paddingHorizontal: 12,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    marginBottom: 32,
  },
  logoImg: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  logoText: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 22,
    color: COLOURS.text,
    letterSpacing: -0.5,
  },
  nav: {
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  navItemActive: {
    backgroundColor: 'rgba(9,99,126,0.08)',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(9,99,126,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: COLOURS.navy,
  },
  navLabel: {
    fontFamily: 'Lato-Bold',
    fontSize: 14,
    color: COLOURS.textDim,
  },
  navLabelActive: {
    color: COLOURS.navy,
  },
});
