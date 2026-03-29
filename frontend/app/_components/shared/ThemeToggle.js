import React, { useRef, useEffect } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme, ACCENT } from '../core/theme';

export default function ThemeToggle() {
  const { resolved, setMode, C } = useTheme();
  const isDark = resolved === 'dark';
  const knob = useRef(new Animated.Value(isDark ? 22 : 0)).current;
  useEffect(() => {
    Animated.spring(knob, { toValue: isDark ? 22 : 0, useNativeDriver: true, tension: 180, friction: 18 }).start();
  }, [isDark]);
  return (
    <Pressable
      onPress={() => setMode(isDark ? 'light' : 'dark')}
      hitSlop={10}
      style={{
        width: 50, height: 28, borderRadius: 14,
        backgroundColor: isDark ? ACCENT + '25' : C.border,
        borderWidth: 1, borderColor: isDark ? ACCENT + '50' : C.borderLight,
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 3,
      }}
    >
      <Animated.View style={{
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: isDark ? ACCENT : '#fff',
        transform: [{ translateX: knob }],
        alignItems: 'center', justifyContent: 'center',
        shadowColor: ACCENT, shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isDark ? 0.8 : 0, shadowRadius: 6, elevation: 3,
      }}>
        <FontAwesome5
          name={isDark ? 'moon' : 'sun'}
          size={10}
          color={isDark ? '#fff' : '#F59E0B'}
          solid
        />
      </Animated.View>
    </Pressable>
  );
}
