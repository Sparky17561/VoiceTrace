import React from 'react';
import AppText from '../core/AppText';
import { View, Text } from 'react-native';
import { useTheme } from '../core/theme';

export default function ConfPill({ conf }) {
  const { C } = useTheme();
  const cfg = {
    high:   { bg: C.tealBg,   border: C.tealBorder,   color: C.teal },
    medium: { bg: C.amberBg,  border: C.amberBorder,  color: C.amber },
    low:    { bg: C.roseBg,   border: C.roseBorder,   color: C.rose },
  };
  const s = cfg[conf] ?? cfg.low;
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: s.border, backgroundColor: s.bg }}>
      <AppText style={{ color: s.color, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>
        {(conf || 'LOW').toUpperCase()}
      </AppText>
    </View>
  );
}
