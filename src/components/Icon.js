// One icon family for the whole UI.
//
// Drop-in for `import { Ionicons } from '@expo/vector-icons'`: same props, but names are drawn
// as Material Design Icons (see utils/iconMap.js), the same family the emoji icons use, so
// weight and style match everywhere. Resolution order for `name`:
//   1. a mapped Ionicons name                    -> its MDI equivalent
//   2. a name that is already an MDI glyph        -> used as is (e.g. "history")
//   3. anything else                              -> real Ionicons, so nothing renders blank

import React from 'react';
import { Ionicons as RealIonicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { IONICON_TO_MDI } from '../utils/iconMap';

export function Ionicons({ name, ...props }) {
  const mapped = IONICON_TO_MDI[name];
  if (mapped) return <MaterialCommunityIcons name={mapped} {...props} />;
  const glyphs = MaterialCommunityIcons.glyphMap;
  if (glyphs && glyphs[name]) return <MaterialCommunityIcons name={name} {...props} />;
  return <RealIonicons name={name} {...props} />;
}
