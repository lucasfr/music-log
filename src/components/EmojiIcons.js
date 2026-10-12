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

function iconNodes(str, size, fallbackColour) {
  return splitEmoji(str).map((part, i) => (
    typeof part === 'string'
      ? part
      : (
        <MaterialCommunityIcons
          key={i}
          name={part.name}
          size={size}
          // A semantic tint if the icon has one, otherwise the text's own colour. If the text
          // sets none, use the theme's text colour: left alone, an icon takes React Native's
          // default black, which disappears on a dark theme.
          color={part.tint ? tintFor(part.tint) : fallbackColour}
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

function convert(children, size, colour) {
  if (typeof children === 'string') return iconNodes(children, size, colour);
  return children.map(c => (typeof c === 'string' && hasEmoji(c) ? iconNodes(c, size, colour) : c));
}

let installed = false;

export function installEmojiIcons() {
  if (installed) return;
  installed = true;
  const original = Text && Text.render;
  if (typeof original !== 'function') return; // unexpected Text implementation: leave emoji alone

  Text.render = function renderWithEmojiIcons(props, ref) {
    if (!needsConversion(props.children)) return original.call(this, props, ref);
    const flat = StyleSheet.flatten(props.style) || {};
    const size = Math.round((flat.fontSize || 14) * 1.1);
    return original.call(this, { ...props, children: convert(props.children, size, flat.color || COLOURS.text) }, ref);
  };
}

installEmojiIcons();
