import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
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
    <BlurView intensity={40} tint="light" style={styles.sidebar}>
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
      <View style={styles.navContainer}>
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
      <View style={{ flex: 1 }} />
    </BlurView>
  );
}

export { SIDEBAR_W };

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_W,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 48,
    margin: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: 'rgba(9,99,126,0.12)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 6,
    overflow: 'hidden',
    paddingTop: Platform.OS === 'web' ? 24 : 48,
    paddingBottom: 24,
    paddingHorizontal: 12,
    zIndex: 10,
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
    fontSize: 28,
    color: COLOURS.text,
    letterSpacing: -0.5,
  },
  nav: {
    gap: 4,
  },
  navContainer: {
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.50)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    padding: 6,
    shadowColor: 'rgba(9,99,126,0.10)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
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
    backgroundColor: 'rgba(9,99,126,0.12)',
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
