import React, { useState, useContext } from 'react';
import AppText from '../core/AppText';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme, ACCENT } from '../core/theme';
import { AppContext } from '../core/AppContext';
import HamburgerBtn from './HamburgerBtn';

export default function ScreenHeader({ title, toggleSidebar, right }) {
  const { C } = useTheme();
  const { stalls, activeStall, setActiveStall, appLocale, changeLanguage, fontSizeScale, setFontSizeScale } = useContext(AppContext);
  const [showPicker, setShowPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);
  
  const LANGS = [
    { id: 'en', name: 'English' },
    { id: 'hi', name: 'हिन्दी' },
    { id: 'mr', name: 'मराठी' }
  ];
  const SIZES = [
    { label: 'A', scale: 1.0, name: 'Normal' },
    { label: 'A+', scale: 1.15, name: 'Large' },
    { label: 'A++', scale: 1.3, name: 'X-Large' }
  ];
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 18, paddingVertical: 14,
      borderBottomWidth: 1, borderColor: C.border,
      backgroundColor: C.surface, zIndex: 100,
    }}>
      <HamburgerBtn onPress={toggleSidebar} color={C.textSub} />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, marginHorizontal: 10 }}>
        {/* Stall Picker */}
        <Pressable
          onPress={() => setShowPicker(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
          hitSlop={8}
        >
          <AppText style={{ color: C.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }} numberOfLines={1}>
            {activeStall?.name || title}
          </AppText>
          {stalls.length > 1 && (
            <FontAwesome5 name="chevron-down" size={10} color={C.textSub} />
          )}
        </Pressable>

        {/* Language Picker */}
        <Pressable
          onPress={() => setShowLangPicker(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surfaceUp, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: C.border }}
          hitSlop={8}
        >
          <FontAwesome5 name="globe" size={11} color={ACCENT} />
          <AppText style={{ color: C.text, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{appLocale}</AppText>
        </Pressable>

        {/* Text Size Picker */}
        <Pressable
          onPress={() => setShowSizePicker(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surfaceUp, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: C.border }}
          hitSlop={8}
        >
          <FontAwesome5 name="font" size={11} color={ACCENT} />
          <AppText style={{ color: C.text, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
            {SIZES.find(s => s.scale === fontSizeScale)?.label || 'A'}
          </AppText>
        </Pressable>
      </View>

      <View style={{ width: 36, alignItems: 'flex-end' }}>{right}</View>

      <Modal visible={showPicker} transparent animationType="fade">
        <Pressable
          onPress={() => setShowPicker(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}
        >
          <View style={{
            backgroundColor: C.surface, borderRadius: 28, padding: 8,
            borderWidth: 1, borderColor: C.border, maxHeight: '65%',
          }}>
            <View style={{ padding: 18, borderBottomWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <FontAwesome5 name="store" size={13} color={C.textSub} />
              <AppText style={{ color: C.textSub, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Switch Shop</AppText>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {stalls.map(s => (
                <Pressable
                  key={s.id}
                  onPress={() => { setActiveStall(s); setShowPicker(false); }}
                  style={{
                    padding: 18,
                    backgroundColor: activeStall?.id === s.id ? C.tealBg : 'transparent',
                    borderRadius: 20, flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'space-between', marginBottom: 2,
                  }}
                >
                  <AppText style={{ color: C.text, fontSize: 17, fontWeight: activeStall?.id === s.id ? '800' : '600' }}>
                    {s.name}
                  </AppText>
                  {activeStall?.id === s.id && (
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
                    }}>
                      <FontAwesome5 name="check" size={10} color="#fff" />
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Language Modal */}
      <Modal visible={showLangPicker} transparent animationType="fade">
        <Pressable
          onPress={() => setShowLangPicker(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}
        >
          <View style={{ backgroundColor: C.surface, borderRadius: 28, padding: 8, borderWidth: 1, borderColor: C.border }}>
            <View style={{ padding: 18, borderBottomWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <FontAwesome5 name="language" size={14} color={C.textSub} />
              <AppText style={{ color: C.textSub, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Select Language</AppText>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {LANGS.map(l => (
                <Pressable
                  key={l.id}
                  onPress={() => { changeLanguage(l.id); setShowLangPicker(false); }}
                  style={{
                    padding: 18,
                    backgroundColor: appLocale === l.id ? C.tealBg : 'transparent',
                    borderRadius: 20, flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'space-between', marginBottom: 2,
                  }}
                >
                  <AppText style={{ color: C.text, fontSize: 17, fontWeight: appLocale === l.id ? '800' : '600' }}>
                    {l.name}
                  </AppText>
                  {appLocale === l.id && (
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name="check" size={10} color="#fff" />
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Font Size Modal */}
      <Modal visible={showSizePicker} transparent animationType="fade">
        <Pressable
          onPress={() => setShowSizePicker(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}
        >
          <View style={{ backgroundColor: C.surface, borderRadius: 28, padding: 8, borderWidth: 1, borderColor: C.border }}>
            <View style={{ padding: 18, borderBottomWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <FontAwesome5 name="font" size={14} color={C.textSub} />
              <AppText style={{ color: C.textSub, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Text Size</AppText>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {SIZES.map(s => (
                <Pressable
                  key={s.label}
                  onPress={() => { setFontSizeScale(s.scale); setShowSizePicker(false); }}
                  style={{
                    padding: 18,
                    backgroundColor: fontSizeScale === s.scale ? C.tealBg : 'transparent',
                    borderRadius: 20, flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'space-between', marginBottom: 2,
                  }}
                >
                  <AppText style={{ color: C.text, fontSize: 17, fontWeight: fontSizeScale === s.scale ? '800' : '600' }}>
                    {s.name} ({s.label})
                  </AppText>
                  {fontSizeScale === s.scale && (
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name="check" size={10} color="#fff" />
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
