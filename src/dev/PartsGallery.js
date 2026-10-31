// The parts gallery: every shared part and token on one page, in whichever theme is active, so a
// change to a part is reviewed once instead of on every screen that uses it.
//
// It is a dev tool, not part of the app's navigation. Open the web build with ?gallery in the
// address (App.js looks for it), or run `node tools/snapshot.mjs --gallery` for a picture in light
// and dark. A new part or token goes in here when it is added, so it is seen in both themes.

import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLOURS, RADIUS, SIZES, TINT_TEXT, TOUCH } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { AppBackground } from '../components/Background';
import {
  GlassCard, Card, SectionTitle, Btn, BtnRow, StatusPill, MetaChip, TagCloud, Divider, EmptyState, RatingMini,
} from '../components/UI';
import { Field, TextF, NumberF, SelectF, DatePickerF, RatingBar } from '../components/Form';
import { STATUS_OPTIONS } from '../constants';
import { todayISO } from '../utils';

function Section({ title, note, children }) {
  return (
    <GlassCard style={{ marginBottom: 16 }}>
      <SectionTitle style={{ marginBottom: note ? 4 : 12 }}>{title}</SectionTitle>
      {note ? (
        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginBottom: 12 }}>{note}</Text>
      ) : null}
      {children}
    </GlassCard>
  );
}

function Row({ children, style }) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }, style]}>
      {children}
    </View>
  );
}

function Swatch({ name, fill, on }) {
  return (
    <View style={{ minWidth: 96, paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.sm, backgroundColor: fill }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: on }}>{name}</Text>
    </View>
  );
}

function Caption({ children }) {
  return <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>{children}</Text>;
}

export function PartsGallery() {
  const { pref, resolved, setTheme, options } = useTheme();
  const [tags, setTags] = useState(['phrasing']);
  const [rating, setRating] = useState(3);
  const [grade, setGrade] = useState('Grade 3');
  const [date, setDate] = useState(todayISO());
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [minutes, setMinutes] = useState('25');

  const toggleTag = t => setTags(cur => (cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]));

  // Read at render time, so they follow the theme.
  const fills = [
    ['navy', COLOURS.navy, COLOURS.onNavy],
    ['steel', COLOURS.steel, COLOURS.onNavy],
    ['success', COLOURS.success, COLOURS.onNavy],
    ['danger', COLOURS.danger, COLOURS.onNavy],
    ['amber', COLOURS.amber, COLOURS.onAmber],
    ['ink', COLOURS.ink, COLOURS.onInk],
  ];
  const tints = [
    ['accentLight', COLOURS.accentLight, COLOURS.practiceText],
    ['accent2Light', COLOURS.accent2Light, COLOURS.lessonText],
    ['challengeLight', COLOURS.challengeLight, COLOURS.textMuted],
    ['yellowLight', COLOURS.yellowLight, COLOURS.lessonText],
    ['dangerLight', COLOURS.dangerLight, COLOURS.red],
    ['successLight', COLOURS.successLight, TINT_TEXT.success],
    ['tealAccent', COLOURS.tealAccent, COLOURS.textMuted],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLOURS.bg }}>
      <AppBackground />
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
          <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.screenTitle, color: COLOURS.text }}>Parts gallery</Text>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textDim, marginBottom: 12 }}>
            Theme in use: {resolved}
          </Text>
          <Row>
            {options.map(o => (
              <Btn key={o.key} label={o.label} variant={pref === o.key ? 'primary' : 'default'}
                onPress={() => setTheme(o.key)} style={{ paddingVertical: 8 }} />
            ))}
          </Row>

          <Section title="Colour on fills" note="Each fill with the colour its text and icons use. A new fill needs an on-colour.">
            <Row>{fills.map(([name, fill, on]) => <Swatch key={name} name={name} fill={fill} on={on} />)}</Row>
          </Section>

          <Section title="Tints" note="Translucent fills and the text that sits on them.">
            <Row>{tints.map(([name, fill, on]) => <Swatch key={name} name={name} fill={fill} on={on} />)}</Row>
          </Section>

          <Section title="Text colours">
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.body, color: COLOURS.text, marginBottom: 4 }}>text: the primary colour</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.body, color: COLOURS.textMuted, marginBottom: 4 }}>textMuted: secondary text</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.body, color: COLOURS.textDim }}>textDim: meta and captions</Text>
          </Section>

          <Section title="Type scale" note="Serif from cardTitle up, Lato below.">
            {Object.entries(SIZES).map(([name, size]) => (
              <View key={name} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                <View style={{ width: 96 }}><Caption>{name} {size}</Caption></View>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: size >= SIZES.cardTitle ? 'CormorantGaramond-Italic' : 'Lato', fontSize: size, color: COLOURS.text }}>
                  Practise slowly
                </Text>
              </View>
            ))}
          </Section>

          <Section title="Radius and touch">
            <Row style={{ alignItems: 'flex-end' }}>
              {Object.entries(RADIUS).map(([name, r]) => (
                <View key={name} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 56, height: 40, borderRadius: r, backgroundColor: COLOURS.navyA(0.14), borderWidth: 1, borderColor: COLOURS.navyA(0.3) }} />
                  <Caption>{name} {r}</Caption>
                </View>
              ))}
            </Row>
            <Row style={{ alignItems: 'flex-end' }}>
              {Object.entries(TOUCH).map(([name, size]) => (
                <View key={name} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={{ width: size, height: size, borderRadius: RADIUS.sm, backgroundColor: COLOURS.tealAccent, borderWidth: 1, borderColor: COLOURS.tealBorder }} />
                  <Caption>touch {name} {size}</Caption>
                </View>
              ))}
            </Row>
          </Section>

          <Section title="Buttons">
            <Row>
              <Btn label="Default" onPress={() => {}} />
              <Btn label="Danger" variant="danger" onPress={() => {}} />
              <Btn label="Disabled" disabled onPress={() => {}} />
            </Row>
            <Btn label="Primary" variant="primary" onPress={() => {}} style={{ marginBottom: 12 }} />
            <Btn label="Primary, disabled" variant="primary" disabled onPress={() => {}} style={{ marginBottom: 12 }} />
            <BtnRow>
              <Btn label="Cancel" onPress={() => {}} />
              <Btn label="Delete" variant="danger" onPress={() => {}} />
            </BtnRow>
          </Section>

          <Section title="Pills, chips and tags">
            <Row>{STATUS_OPTIONS.map(s => <StatusPill key={s} status={s} />)}</Row>
            <Row>
              <MetaChip label="Grade 3" />
              <MetaChip label="25 min" />
              <MetaChip label="4/4" />
            </Row>
            <TagCloud tags={['hand-coordination', 'phrasing', 'fingering', 'rhythm']} selected={tags} onToggle={toggleTag} />
          </Section>

          <Section title="Ratings">
            <Row>
              <RatingMini emoji="⭐" value={3} />
              <RatingMini emoji="⚡" value={4} />
            </Row>
            <RatingBar label="Enjoyment" emoji="⭐" value={rating} onChange={setRating} />
          </Section>

          <Section title="Form fields">
            <Field label="Title"><TextF value={title} onChange={setTitle} placeholder="Piece or exercise" /></Field>
            <Field label="Notes"><TextF value={notes} onChange={setNotes} placeholder="What went well?" multiline /></Field>
            <Field label="Minutes"><NumberF value={minutes} onChange={setMinutes} placeholder="0" /></Field>
            <SelectF label="Grade" value={grade} onChange={setGrade} options={['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4']} placeholder="Choose a grade" />
            <DatePickerF label="Date" value={date} onChange={setDate} />
          </Section>

          <Section title="Cards, dividers and empty states">
            <Card>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.body, color: COLOURS.text }}>Card: no blur, for use inside modals.</Text>
            </Card>
            <Divider />
            <EmptyState icon="🎹" text="Nothing here yet" />
          </Section>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
