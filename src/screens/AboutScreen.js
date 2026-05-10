import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';

const YEAR = new Date().getFullYear();

function GlassCard({ children }) {
  return (
    <BlurView intensity={40} tint="light" style={{
      borderRadius: 18, overflow: 'hidden', marginBottom: 12,
      shadowColor: 'rgba(9,99,126,0.10)', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1, shadowRadius: 16, elevation: 4,
    }}>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.58)', padding: 18 }}>
        {children}
      </View>
    </BlurView>
  );
}

function CardLabel({ children }) {
  return (
    <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.steel, letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 12 }}>
      {children}
    </Text>
  );
}

export default function AboutScreen({ isDesktop }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingLeft: isDesktop ? 238 : 16, paddingTop: 8, paddingBottom: 80 }}>

        {/* Hero */}
        <View style={{ alignItems: 'center', paddingVertical: 36, gap: 4 }}>
          <Image
            source={require('../../assets/icon.png')}
            style={{ width: 90, height: 90, borderRadius: 22 }}
          />
          <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 36, color: COLOURS.text, marginTop: 14, letterSpacing: -0.5 }}>
            music<Text style={{ color: COLOURS.practiceText }}>.</Text>
            <Text style={{ color: COLOURS.lessonText }}>log</Text>
          </Text>
          <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, letterSpacing: 1.4, marginTop: 2 }}>v1.0.0</Text>
        </View>

        {/* Why this exists */}
        <GlassCard>
          <CardLabel>Why this exists</CardLabel>
          <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textMuted, lineHeight: 24 }}>
            Starting piano as an adult is humbling. Progress is real but hard to see day to day — and practice without reflection tends to plateau. music.log is a quiet space to record what you worked on, how it felt, and watch the arc of improvement over weeks and months.
          </Text>
        </GlassCard>

        {/* How it works */}
        <GlassCard>
          <CardLabel>How it works</CardLabel>
          {[
            ['🎹', 'Log a session',   'Record duration, energy, pieces practised, and what you worked on in each segment.'],
            ['🎓', 'Log lessons',      'Capture teacher feedback, assignments, and what was covered — before you forget.'],
            ['📜', 'Build a library',  'Keep a catalogue of your repertoire with status, key, and time signature.'],
            ['📊', 'Track over time',  'Charts, streaks, and monthly stats show you the bigger picture.'],
          ].map(([icon, title, body]) => (
            <View key={title} style={{ flexDirection: 'row', gap: 14, marginBottom: 14, alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 22, width: 28, textAlign: 'center', marginTop: 1 }}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text, marginBottom: 2 }}>{title}</Text>
                <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted, lineHeight: 20 }}>{body}</Text>
              </View>
            </View>
          ))}
        </GlassCard>

        {/* Built with */}
        <GlassCard>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: COLOURS.text, marginBottom: 14 }}>Made with ❤️ and 🎹</Text>
            <View style={{ height: 1, backgroundColor: 'rgba(9,99,126,0.08)', width: '100%', marginBottom: 14 }} />
            <View style={{ alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <View style={{ paddingVertical: 3, paddingHorizontal: 10, backgroundColor: COLOURS.navy, borderRadius: 6 }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: '#fff', letterSpacing: 0.5 }}>MIT</Text>
              </View>
              <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textMuted, lineHeight: 18, textAlign: 'center' }}>
                {`Licensed under the MIT Licence\nCopyright © ${YEAR} Lucas França\nOpen source, free to use and modify.`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { if (typeof window !== 'undefined') window.open('https://lfranca.uk', '_blank'); }}>
              <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.steel, textDecorationLine: 'underline' }}>lfranca.uk</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

      </ScrollView>
    </SafeAreaView>
  );
}
