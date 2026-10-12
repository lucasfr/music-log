// Draws known emoji as Material Design Icons wherever they appear inside <Text>.
//
// Importing this file (once, from App.js) wraps Text's render: any string child containing
// an emoji from utils/emojiIcons.js is split, and each emoji becomes an inline icon that is
// sized to the surrounding fontSize and takes the surrounding colour (or a semantic tint,
// e.g. amber for ⚡). Because the icon lives inside the same <Text>, anything set on that
// Text keeps applying: opacity and scale (the rating bars dim unfilled icons that way),
// numberOfLines, selectable, and so on.
//
// It's a no-op for text with no known emoji, and if Text isn't shaped the way this expects
// the install bails out and emoji simply stay as emoji.

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLOURS } from '../theme';
import { hasEmoji, splitEmoji } from '../utils/emojiIcons';

// Semantic tints, resolved when drawn so they follow the active theme.
const tintFor = tint => ({
  amber: COLOURS.amber,
  gold: COLOURS.gold,
  success: COLOURS.success,
  heart: '#E5566D',
})[tint];

function iconNodes(str, size) {
  return splitEmoji(str).map((part, i) => (
    typeof part === 'string'
      ? part
      : (
        <MaterialCommunityIcons
          key={i}
          name={part.name}
          size={size}
          color={part.tint ? tintFor(part.tint) : undefined}
          accessible={false}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
      )
  ));
}

function needsConversion(children) {
  if (typeof children === 'string') return hasEmoji(children);
  if (Array.isArray(children)) return children.some(c => typeof c === 'string' && hasEmoji(c));
  return false;
}

function convert(children, size) {
  if (typeof children === 'string') return iconNodes(children, size);
  return children.map(c => (typeof c === 'string' && hasEmoji(c) ? iconNodes(c, size) : c));
}

let installed = false;

export function installEmojiIcons() {
  if (installed) return;
  installed = true;
  const original = Text && Text.render;
  if (typeof original !== 'function') return; // unexpected Text implementation: leave emoji alone

  Text.render = function renderWithEmojiIcons(props, ref) {
    if (!needsConversion(props.children)) return original.call(this, props, ref);
    const fontSize = (StyleSheet.flatten(props.style) || {}).fontSize || 14;
    return original.call(this, { ...props, children: convert(props.children, Math.round(fontSize * 1.1)) }, ref);
  };
}

installEmojiIcons();
