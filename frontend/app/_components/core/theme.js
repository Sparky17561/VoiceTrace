import React, { useState, useEffect, useContext, createContext } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// ── PRIMARY ACCENT — Electric Blue ──
export const ACCENT = '#0A84FF';
export const ACCENT_DARK = '#2563EB';
export const FONT_MONO = Platform.select({ ios: 'Courier New', android: 'monospace' });

// ── DARK MODE — Deep Navy / Aura System ──
export const DARK = {
  bg:           '#0B0F1A',   // deepest navy
  bgElevated:   '#0F1522',   // slightly elevated bg
  surface:      '#121826',   // card surface
  surfaceUp:    '#181F2E',   // elevated card
  border:       '#1E2A3D',   // subtle border
  borderLight:  '#253347',   // lighter border

  text:         '#EDF2FF',   // near-white blue tint
  textSub:      '#7B8EAF',   // muted blue-gray
  textFaint:    '#3A4A65',   // very faint

  // Primary accent → electric blue (property name kept for component compat)
  teal:         '#0A84FF',
  tealBg:       '#0A84FF14',
  tealBorder:   '#0A84FF35',

  // Error → soft red
  rose:         '#FF453A',
  roseBg:       '#FF453A12',
  roseBorder:   '#FF453A30',

  // Warning → warm amber
  amber:        '#FF9F0A',
  amberBg:      '#FF9F0A12',
  amberBorder:  '#FF9F0A30',

  // Credit/Udhari → soft indigo
  indigo:       '#5E5CE6',
  indigoBg:     '#5E5CE614',
  indigoBorder: '#5E5CE630',

  // Success (for settled states)
  green:        '#30D158',
  greenBg:      '#30D15812',
  greenBorder:  '#30D15830',
};

// ── LIGHT MODE — Soft White-Blue ──
export const LIGHT = {
  bg:           '#F5F8FF',   // spec: soft blue-white
  bgElevated:   '#EDF1FF',
  surface:      '#FFFFFF',
  surfaceUp:    '#F0F5FF',
  border:       '#E2E8F5',
  borderLight:  '#EBF0FC',

  text:         '#0F172A',
  textSub:      '#475E8A',
  textFaint:    '#B8C5DC',

  teal:         '#0A84FF',
  tealBg:       '#0A84FF10',
  tealBorder:   '#0A84FF28',

  rose:         '#D93B30',
  roseBg:       '#D93B3010',
  roseBorder:   '#D93B3028',

  amber:        '#C07800',
  amberBg:      '#C0780010',
  amberBorder:  '#C0780028',

  indigo:       '#4F46E5',
  indigoBg:     '#4F46E510',
  indigoBorder: '#4F46E528',

  green:        '#1A9E4A',
  greenBg:      '#1A9E4A10',
  greenBorder:  '#1A9E4A28',
};

// ── THEME CONTEXT ──
export const ThemeContext = createContext();

// ── THEME PROVIDER ──
export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState(null);
  useEffect(() => {
    SecureStore.getItemAsync('colorMode').then(v => { if (v === 'light' || v === 'dark') setModeState(v); });
  }, []);
  const setMode = m => { setModeState(m); SecureStore.setItemAsync('colorMode', m || ''); };
  const resolved = mode ?? system ?? 'dark';
  const C = resolved === 'dark' ? DARK : LIGHT;
  return <ThemeContext.Provider value={{ C, resolved, setMode }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
