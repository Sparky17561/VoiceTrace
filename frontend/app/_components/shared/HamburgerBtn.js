import React from 'react';
import { View, Pressable } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

export default function HamburgerBtn({ onPress, color }) {
  return (
    <Pressable onPress={onPress} hitSlop={14} style={{ padding: 6, gap: 5 }}>
      <View style={{ height: 2, width: 22, backgroundColor: color, borderRadius: 2 }} />
      <View style={{ height: 2, width: 15, backgroundColor: color, borderRadius: 2 }} />
      <View style={{ height: 2, width: 19, backgroundColor: color, borderRadius: 2 }} />
    </Pressable>
  );
}
