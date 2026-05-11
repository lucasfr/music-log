import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Picker } from '@react-native-picker/picker';
import { COLOURS, RADIUS, SIZES } from '../theme';
import { Label } from './UI';

// ─── Helpers for DatePickerF ─────────────────────────────────────────────────────

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function calDays(year, month) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const total  = new Date(year, month + 1, 0).getDate();
  const cells  = Array(offset).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isoFor(y, m, d) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function Field({ label, children, style, icon }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Label icon={icon}>{label}</Label> : null}
      {children}
    </View>
  );
}

// Shared input surface — frosted, no border, shadow lift
const inputStyle = {
  backgroundColor: 'rgba(255,255,255,0.62)',
  borderRadius: RADIUS.sm,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: SIZES.body,
  fontFamily: 'Lato',
  color: COLOURS.text,
  shadowColor: COLOURS.glassShadow,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 1,
  shadowRadius: 10,
  elevation: 2,
};

export function TextF({ value, onChange, placeholder, multiline, style }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={COLOURS.textDim}
      multiline={multiline}
      style={[inputStyle, {
        minHeight: multiline ? 76 : undefined,
        textAlignVertical: multiline ? 'top' : 'auto',
      }, style]}
    />
  );
}

export function NumberF({ value, onChange, placeholder, style }) {
  return (
    <TextInput
      value={value ? String(value) : ''}
      onChangeText={onChange}
      placeholder={placeholder || '0'}
      placeholderTextColor={COLOURS.textDim}
      keyboardType="number-pad"
      style={[inputStyle, style]}
    />
  );
}

export function SelectF({ label, value, onChange, options, placeholder }) {
  const [open, setOpen] = React.useState(false);
  const display = options.find(o => (o.value ?? o) === value)?.label
    ?? (typeof value === 'string' && value ? value : (placeholder || '—'));

  if (Platform.OS === 'ios') {
    return (
      <>
        <Field label={label}>
          <TouchableOpacity
            onPress={() => setOpen(true)}
            activeOpacity={0.8}
            style={[inputStyle, {
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 11,
            }]}
          >
            <Text style={{ fontSize: SIZES.body, fontFamily: 'Lato', color: value ? COLOURS.text : COLOURS.textDim }}>
              {display}
            </Text>
            <Text style={{ fontSize: 12, color: COLOURS.textDim }}>▾</Text>
          </TouchableOpacity>
        </Field>
        <Modal visible={open} transparent animationType="slide">
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setOpen(false)} activeOpacity={1}>
            <View style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              backgroundColor: 'rgba(235,244,246,0.97)',
              borderTopLeftRadius: RADIUS.xl,
              borderTopRightRadius: RADIUS.xl,
              shadowColor: COLOURS.glassShadowMd,
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 1,
              shadowRadius: 24,
              elevation: 20,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 14, borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorderSubtle }}>
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Text style={{ fontFamily: 'Lato-Bold', color: COLOURS.navy, fontSize: 16 }}>Done</Text>
                </TouchableOpacity>
              </View>
              <Picker
                selectedValue={value || ''}
                onValueChange={v => onChange(v)}
                style={{ backgroundColor: 'transparent' }}
              >
                <Picker.Item label={placeholder || '—'} value="" color={COLOURS.textDim} />
                {options.map(o => {
                  const v = o.value ?? o;
                  const l = o.label ?? o;
                  return <Picker.Item key={v} label={l} value={v} color={COLOURS.text} />;
                })}
              </Picker>
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    );
  }

  return (
    <Field label={label}>
      <View style={[inputStyle, { overflow: 'hidden', paddingHorizontal: 0, paddingVertical: 0 }]}>
        <Picker selectedValue={value || ''} onValueChange={onChange} style={{ color: COLOURS.text, height: 44 }}>
          <Picker.Item label={placeholder || '—'} value="" />
          {options.map(o => {
            const v = o.value ?? o;
            const l = o.label ?? o;
            return <Picker.Item key={v} label={l} value={v} />;
          })}
        </Picker>
      </View>
    </Field>
  );
}

// ─── Date picker ───────────────────────────────────────────────────────────────

export function DatePickerF({ label, value, onChange, icon }) {
  const [open, setOpen] = React.useState(false);
  const today = todayISO();
  // Measure the trigger button width so the calendar grid fits exactly
  const [containerW, setContainerW] = React.useState(0);

  const initDate = value ? new Date(value + 'T12:00:00') : new Date();
  const [viewYear,  setViewYear]  = React.useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(initDate.getMonth());

  // Keep calendar in sync if value changes externally
  React.useEffect(() => {
    if (value) {
      const d = new Date(value + 'T12:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const cells = calDays(viewYear, viewMonth);
  // 32px = 16px padding each side inside the BlurView
  const availableW = containerW > 0 ? containerW - 32 : 252;
  // Cap at 44 so it doesn't get absurdly large on desktop
  const CELL_W = Math.min(44, Math.max(32, Math.floor(availableW / 7)));
  const CELL_H = CELL_W;

  const calendar = (
    <BlurView intensity={60} tint="light" style={{
      borderRadius: 20, overflow: 'hidden',
      shadowColor: 'rgba(9,99,126,0.18)', shadowOffset:{width:0,height:12}, shadowOpacity:1, shadowRadius:32, elevation:16,
    }}>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.65)', padding: 16 }}>
        {/* Month nav */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <TouchableOpacity onPress={prevMonth} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Text style={{ fontSize: 26, color: COLOURS.navy, fontWeight: '300', lineHeight: 30 }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 18, color: COLOURS.text }}>
            {MONTHS_LONG[viewMonth]} {viewYear}
          </Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Text style={{ fontSize: 26, color: COLOURS.navy, fontWeight: '300', lineHeight: 30 }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Day headers */}
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          {DAYS_SHORT.map((d, i) => (
            <View key={i} style={{ width: CELL_W, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Grid */}
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <View key={row} style={{ flexDirection: 'row' }}>
            {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
              if (!day) return <View key={col} style={{ width: CELL_W, height: CELL_H }} />;
              const iso = isoFor(viewYear, viewMonth, day);
              const isSelected = iso === value;
              const isToday    = iso === today;
              const isFuture   = iso > today;
              return (
                <TouchableOpacity
                  key={col}
                  onPress={() => { if (!isFuture) { onChange(iso); setOpen(false); } }}
                  activeOpacity={isFuture ? 1 : 0.7}
                  style={{
                    width: CELL_W, height: CELL_H,
                    alignItems: 'center', justifyContent: 'center',
                    borderRadius: CELL_H / 2,
                    backgroundColor: isSelected
                      ? COLOURS.navy
                      : isToday
                        ? 'rgba(9,99,126,0.10)'
                        : 'transparent',
                  }}
                >
                  <Text style={{
                    fontFamily: isSelected || isToday ? 'Lato-Bold' : 'Lato',
                    fontSize: 14,
                    color: isSelected
                      ? '#fff'
                      : isFuture
                        ? COLOURS.textDim
                        : isToday
                          ? COLOURS.navy
                          : COLOURS.text,
                  }}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Today shortcut */}
        <TouchableOpacity
          onPress={() => { onChange(today); setOpen(false); }}
          activeOpacity={0.75}
          style={{ alignSelf: 'center', marginTop: 12, paddingHorizontal: 16, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: COLOURS.glassShadow, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 }}
        >
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: 13, color: COLOURS.navy }}>Today</Text>
        </TouchableOpacity>
      </View>
    </BlurView>
  );

  return (
    <Field label={label} icon={icon}>
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        onLayout={e => setContainerW(e.nativeEvent.layout.width)}
        activeOpacity={0.8}
        style={[inputStyle, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 }]}
      >
        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.body, color: value ? COLOURS.text : COLOURS.textDim }}>
          {value ? fmtDisplay(value) : 'Select date…'}
        </Text>
        <Text style={{ fontSize: 14, color: COLOURS.textDim }}>{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>

      {/* Inline calendar dropdown */}
      {open && (
        <View style={{ marginTop: 6, zIndex: 100 }}>
          {calendar}
        </View>
      )}
    </Field>
  );
}
