import React, { useContext } from 'react';
import AppText from '../core/AppText';
import { View, Text, Pressable } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme, ACCENT } from '../core/theme';
import { AppContext } from '../core/AppContext';
import { ThemeToggle } from '../shared';
import i18n from '../../../translations';

// AppSidebar is purely presentational — no internal navigation state.
// Receives activeScreen + setActiveScreen as props to avoid circular deps.
export default function AppSidebar({ currentRoute, setRoute, close, logout }) {
  const { C } = useTheme();
  // fontSizeScale logic has been moved to ScreenHeader.js

  const menu = [
    { id: 'ask',       icon: 'microphone',  label: i18n.t('askTab',    { defaultValue: 'Ask Voice' }) },
    { id: 'dashboard', icon: 'chart-line',  label: i18n.t('dashboard', { defaultValue: 'Dashboard' }) },
    { id: 'udhari',    icon: 'hands-helping',label: i18n.t('udhari',   { defaultValue: 'Udhari' }) },
    { id: 'history',   icon: 'history',     label: i18n.t('history',   { defaultValue: 'History' }) },
    { id: 'shops',     icon: 'store',       label: i18n.t('shops',     { defaultValue: 'My Shops' }) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.surface, paddingTop: 60, paddingHorizontal: 20 }}>

      {/* Brand header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 44 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 38, height: 38, borderRadius: 11,
            backgroundColor: ACCENT,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
          }}>
            <FontAwesome5 name="microphone" size={16} color="#fff" />
          </View>
          <View>
            <AppText style={{ color: C.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.4 }}>VoiceTrace</AppText>
            <AppText style={{ color: C.textFaint, fontSize: 10, fontWeight: '600' }}>AI Business Brain</AppText>
          </View>
        </View>
        <ThemeToggle />
      </View>

      {/* Nav items */}
      <View style={{ gap: 4, flex: 1 }}>
        {menu.map(m => {
          const active = currentRoute === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => { setRoute(m.id); close(); }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                paddingVertical: 14, paddingHorizontal: 16,
                borderRadius: 16,
                backgroundColor: active ? ACCENT + '18' : 'transparent',
                borderWidth: active ? 1 : 0,
                borderColor: active ? ACCENT + '35' : 'transparent',
              }}
            >
              <View style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: active ? ACCENT + '25' : C.surfaceUp,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <FontAwesome5
                  name={m.icon}
                  size={14}
                  color={active ? ACCENT : C.textSub}
                  solid={active}
                />
              </View>
              <AppText style={{
                color: active ? ACCENT : C.text,
                fontSize: 15,
                fontWeight: active ? '800' : '600',
              }}>
                {m.label}
              </AppText>
              {active && (
                <View style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT }} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Logout */}
      <Pressable
        onPress={logout}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 14,
          paddingVertical: 14, paddingHorizontal: 16, marginBottom: 30,
          borderRadius: 16, borderWidth: 1, borderColor: C.roseBorder,
          backgroundColor: C.roseBg,
        }}
      >
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.rose + '20', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="sign-out-alt" size={14} color={C.rose} />
        </View>
        <AppText style={{ color: C.rose, fontSize: 15, fontWeight: '700' }}>
          {i18n.t('logout', { defaultValue: 'Log out' })}
        </AppText>
      </Pressable>
    </View>
  );
}
