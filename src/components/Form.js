import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Modal, Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme, RADIUS } from '../theme';
import { Label } from './UI';

export function Field({ label, children, style }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Label>{label}</Label> : null}
      {children}
    </View>
  );
}

export function TextF({ value, onChange, placeholder, multiline, style }) {
  const C = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={C.ink3}
      multiline={multiline}
      style={[{
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border2,
        borderRadius: RADIUS.sm,
        paddingHorizontal: 11,
        paddingVertical: 9,
        fontSize: 14,
        color: C.ink,
        fontFamily: 'System',
        minHeight: multiline ? 72 : undefined,
        textAlignVertical: multiline ? 'top' : 'auto',
      }, style]}
    />
  );
}

export function NumberF({ value, onChange, placeholder, style }) {
  const C = useTheme();
  return (
    <TextInput
      value={value ? String(value) : ''}
      onChangeText={onChange}
      placeholder={placeholder || '0'}
      placeholderTextColor={C.ink3}
      keyboardType="number-pad"
      style={[{
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border2,
        borderRadius: RADIUS.sm,
        paddingHorizontal: 11,
        paddingVertical: 9,
        fontSize: 14,
        color: C.ink,
      }, style]}
    />
  );
}

// Native picker wrapped in a tappable field
export function SelectF({ label, value, onChange, options, placeholder }) {
  const C = useTheme();
  const [open, setOpen] = React.useState(false);
  const display = options.find(o => (o.value ?? o) === value)?.label ?? value ?? placeholder ?? '—';

  if (Platform.OS === 'ios') {
    return (
      <>
        <Field label={label}>
          <TouchableOpacity
            onPress={() => setOpen(true)}
            activeOpacity={0.8}
            style={{
              backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2,
              borderRadius: RADIUS.sm, paddingHorizontal: 11, paddingVertical: 10,
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 14, color: value ? C.ink : C.ink3 }}>{display}</Text>
            <Text style={{ fontSize: 12, color: C.ink3 }}>▾</Text>
          </TouchableOpacity>
        </Field>
        <Modal visible={open} transparent animationType="slide">
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setOpen(false)} activeOpacity={1}>
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Text style={{ color: C.accent, fontSize: 16, fontWeight: '500' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <Picker
                selectedValue={value || ''}
                onValueChange={v => { onChange(v); }}
                style={{ backgroundColor: C.card }}
              >
                <Picker.Item label={placeholder || '—'} value="" color={C.ink3} />
                {options.map(o => {
                  const v = o.value ?? o;
                  const l = o.label ?? o;
                  return <Picker.Item key={v} label={l} value={v} color={C.ink} />;
                })}
              </Picker>
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    );
  }

  // Android — Picker renders inline
  return (
    <Field label={label}>
      <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2, borderRadius: RADIUS.sm, overflow: 'hidden' }}>
        <Picker selectedValue={value || ''} onValueChange={onChange} style={{ color: C.ink, height: 44 }}>
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
