import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { COLOURS, RADIUS } from '../theme';
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
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={COLOURS.textDim}
      multiline={multiline}
      style={[{
        backgroundColor: 'rgba(255,255,255,0.65)',
        borderWidth: 1,
        borderColor: COLOURS.glassBorder,
        borderRadius: RADIUS.sm,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        fontFamily: 'SourceSans3',
        color: COLOURS.text,
        minHeight: multiline ? 76 : undefined,
        textAlignVertical: multiline ? 'top' : 'auto',
        shadowColor: COLOURS.glassShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 2,
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
      style={[{
        backgroundColor: 'rgba(255,255,255,0.78)',
        borderWidth: 1,
        borderColor: COLOURS.glassBorder,
        borderRadius: RADIUS.sm,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        fontFamily: 'SourceSans3',
        color: COLOURS.text,
        shadowColor: COLOURS.glassShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 2,
      }, style]}
    />
  );
}

export function SelectF({ label, value, onChange, options, placeholder }) {
  const [open, setOpen] = React.useState(false);
  const display = options.find(o => (o.value ?? o) === value)?.label ?? (typeof value === 'string' && value) ? value : (placeholder || '—');

  if (Platform.OS === 'ios') {
    return (
      <>
        <Field label={label}>
          <TouchableOpacity
            onPress={() => setOpen(true)}
            activeOpacity={0.8}
            style={{
              backgroundColor: 'rgba(255,255,255,0.65)',
              borderWidth: 1,
              borderColor: COLOURS.glassBorder,
              borderRadius: RADIUS.sm,
              paddingHorizontal: 12,
              paddingVertical: 11,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              shadowColor: COLOURS.glassShadow,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 1,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <Text style={{ fontSize: 15, fontFamily: 'SourceSans3', color: value ? COLOURS.text : COLOURS.textDim }}>
              {display}
            </Text>
            <Text style={{ fontSize: 12, color: COLOURS.textDim }}>▾</Text>
          </TouchableOpacity>
        </Field>
        <Modal visible={open} transparent animationType="slide">
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setOpen(false)} activeOpacity={1}>
            <View style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              backgroundColor: 'rgba(234,240,245,0.97)',
              borderTopWidth: 1, borderTopColor: COLOURS.glassBorder,
              borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 14, borderBottomWidth: 1, borderBottomColor: COLOURS.glassBorder }}>
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Text style={{ fontFamily: 'SourceSans3-Bold', color: COLOURS.navy, fontSize: 16 }}>Done</Text>
                </TouchableOpacity>
              </View>
              <Picker
                selectedValue={value || ''}
                onValueChange={v => { onChange(v); }}
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
      <View style={{
        backgroundColor: 'rgba(255,255,255,0.65)', borderWidth: 1, borderColor: COLOURS.glassBorder,
        borderRadius: RADIUS.sm, overflow: 'hidden',
      }}>
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
