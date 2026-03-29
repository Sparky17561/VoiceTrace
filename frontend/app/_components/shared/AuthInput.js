import React, { useState } from 'react';
import AppText from '../core/AppText';
import { View, Text, TextInput } from 'react-native';
import { useTheme, ACCENT } from '../core/theme';

export default function AuthInput({ label, ...props }) {
  const { C } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <AppText style={{
        color: C.textSub, fontSize: 11, fontWeight: '700',
        letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase',
      }}>
        {label}
      </AppText>
      <TextInput
        style={{
          backgroundColor: C.surfaceUp,
          color: C.text,
          padding: 16,
          borderRadius: 16,
          fontSize: 16,
          borderWidth: focused ? 1.5 : 1,
          borderColor: focused ? ACCENT + 'AA' : C.border,
        }}
        placeholderTextColor={C.textFaint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
    </View>
  );
}
