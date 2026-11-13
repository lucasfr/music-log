import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLOURS, SIZES } from '../theme';
import { AppearanceSection } from './settings/AppearanceSection';
import { PracticeSection } from './settings/PracticeSection';
import { BackupSection } from './settings/BackupSection';
import { SyncSection } from './settings/SyncSection';
import { DangerSection } from './settings/DangerSection';

// Settings, one section per file in ./settings (the same way Stats is split). This file keeps the page
// itself: the title, the scroll view, and the one fact the sections share, whether anyone is signed in to
// Supabase (the Sync section reports it, the Danger zone words its warning by it).
export default function SettingsScreen({ isDesktop, sessions = [], lessons = [], compositions = [], onSaveSession, onSaveLesson, onSaveComposition, onClearAll }) {
  const [isSignedIn, setIsSignedIn] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingLeft: isDesktop ? 238 : 16, paddingTop: 8, paddingBottom: 60 }}>

        {/* Page title */}
        <View style={{ marginBottom: 4, marginTop: 4 }}>
          <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.screenTitle, color: COLOURS.text, letterSpacing: -0.3 }}>Settings</Text>
        </View>

        <AppearanceSection />
        <PracticeSection />
        <BackupSection
          sessions={sessions} lessons={lessons} compositions={compositions}
          onSaveSession={onSaveSession} onSaveLesson={onSaveLesson} onSaveComposition={onSaveComposition}
        />
        <SyncSection
          sessions={sessions} lessons={lessons} compositions={compositions}
          onSaveSession={onSaveSession} onSaveLesson={onSaveLesson} onSaveComposition={onSaveComposition}
          onSignedInChange={setIsSignedIn}
        />
        <DangerSection
          sessions={sessions} lessons={lessons} compositions={compositions}
          onClearAll={onClearAll} isSignedIn={isSignedIn}
        />

      </ScrollView>
    </SafeAreaView>
  );
}
