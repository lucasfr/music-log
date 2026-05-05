import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { COLOURS, RADIUS, SIZES } from '../theme';
import { Label } from './UI';

export function Field({ label, children, style }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Label>{label}</Label> : null}
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
  fontFamily: 'SourceSans3',
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
            <Text style={{ fontSize: SIZES.body, fontFamily: 'SourceSans3', color: value ? COLOURS.text : COLOURS.textDim }}>
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
                  <Text style={{ fontFamily: 'SourceSans3-Bold', color: COLOURS.navy, fontSize: 16 }}>Done</Text>
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
