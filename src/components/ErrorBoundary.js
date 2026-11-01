// Catches a render error in whatever it wraps and shows a way out instead of a blank screen: try again,
// or export a backup of everything on this device first (the data is read straight from storage, so
// it works even when the screen that crashed was the one holding it).
//
//   <ErrorBoundary name="Stats">...</ErrorBoundary>
//   <ErrorBoundary name="Home" resetKeys={[resolved]}>...</ErrorBoundary>   // tries again when a key changes
//
// A boundary catches errors thrown while rendering. It does not see errors in event handlers or in
// async code (a failed save, say): those are reported where they happen (see guardLocalWrite in
// db/hooks.js). The fallback uses only plain React Native parts and theme tokens, so it can still draw
// when the part that failed was one of the shared components.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLOURS, SIZES, RADIUS, TOUCH } from '../theme';
import { describeError, resetKeysChanged } from '../utils/errorBoundary';
import { getAllSessions, getAllLessons, getAllCompositions } from '../db';
import { exportAllJSON } from '../utils/export';

export class ErrorBoundary extends React.Component {
  state = { failed: false, error: null, busy: false, note: '' };

  static getDerivedStateFromError(error) {
    return { failed: true, error, note: '' };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary${this.props.name ? ` ${this.props.name}` : ''}]`, error, info && info.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.failed && resetKeysChanged(prev.resetKeys, this.props.resetKeys)) this.reset();
  }

  reset = () => {
    this.setState({ failed: false, error: null, busy: false, note: '' });
    if (this.props.onReset) this.props.onReset();
  };

  exportBackup = async () => {
    this.setState({ busy: true, note: '' });
    try {
      const [sessions, lessons, compositions] = await Promise.all([getAllSessions(), getAllLessons(), getAllCompositions()]);
      await exportAllJSON(sessions, lessons, compositions);
      this.setState({ busy: false, note: 'Backup exported.' });
    } catch (e) {
      this.setState({ busy: false, note: `Couldn't export a backup: ${describeError(e, 80)}` });
    }
  };

  render() {
    if (!this.state.failed) return this.props.children;
    const { name } = this.props;
    const { busy, note, error } = this.state;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLOURS.bg }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.sectionTitle, color: COLOURS.text }}>
            {name ? `Something went wrong in ${name}` : 'Something went wrong'}
          </Text>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.body, lineHeight: 24, color: COLOURS.text, marginTop: 12 }}>
            Your sessions, lessons and pieces are stored on this device and were not touched. You can export a backup, then try again.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
            <TouchableOpacity
              onPress={this.reset}
              accessibilityRole="button"
              accessibilityLabel="Try again"
              style={{ minHeight: TOUCH.min, paddingHorizontal: 24, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.body, color: COLOURS.onNavy }}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={this.exportBackup}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Export a backup of everything on this device"
              style={{ minHeight: TOUCH.min, paddingHorizontal: 24, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navyA(0.1), alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}
            >
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.body, color: COLOURS.text }}>{busy ? 'Exporting…' : 'Export backup'}</Text>
            </TouchableOpacity>
          </View>
          {note ? (
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.text, marginTop: 16 }}>{note}</Text>
          ) : null}
          <Text selectable numberOfLines={3} style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginTop: 16 }}>
            {describeError(error)}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
}
