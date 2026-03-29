import React, { useState } from 'react';
import AppText from '../core/AppText';
import { View, Text, Pressable, Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import { useTheme, ACCENT } from '../core/theme';
import { API_BASE } from '../utils/constants';
import { AuthInput } from '../shared';

export default function OnboardingScreen({ token, onComplete }) {
  const { C } = useTheme();
  const [step, setStep] = useState(1);
  const [shopName, setShopName] = useState('');
  const [items, setItems] = useState([{ name: '', price: '' }]);
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    if (!shopName) return Alert.alert('Wait', 'Shop name is required');
    const validItems = items.filter(i => i.name && i.price).map(i => ({ name: i.name, price: parseFloat(i.price) }));
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/onboarding/complete`, { stall_name: shopName, items: validItems }, { headers: { Authorization: `Bearer ${token}` } });
      onComplete();
    } catch { Alert.alert('Error', 'Failed to save setup'); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, padding: 24 }}>

        {/* Step indicator */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 40 }}>
          {[1, 2].map(s => (
            <View key={s} style={{
              height: 4, flex: 1, borderRadius: 2,
              backgroundColor: step >= s ? ACCENT : C.border,
            }} />
          ))}
        </View>

        {/* Icon */}
        <View style={{
          width: 64, height: 64, borderRadius: 20, backgroundColor: ACCENT + '20',
          alignItems: 'center', justifyContent: 'center', marginBottom: 28,
          borderWidth: 1.5, borderColor: ACCENT + '40',
          shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
        }}>
          <FontAwesome5 name={step === 1 ? 'store' : 'utensils'} size={26} color={ACCENT} />
        </View>

        <AppText style={{ color: C.text, fontSize: 28, fontWeight: '900', marginBottom: 10, letterSpacing: -0.5 }}>
          {step === 1 ? 'Welcome!' : 'Add Menu Items'}
        </AppText>
        <AppText style={{ color: C.textSub, fontSize: 15, marginBottom: 36, lineHeight: 24 }}>
          {step === 1
            ? "Let's set up your first shop to get started."
            : "What do you sell? We'll use this to calculate prices when you speak."
          }
        </AppText>

        {step === 1 ? (
          <View style={{ backgroundColor: C.surface, padding: 22, borderRadius: 24, borderWidth: 1, borderColor: C.border }}>
            <AuthInput label="Shop Name" value={shopName} onChangeText={setShopName} placeholder="e.g. Raju Vadapav" />
            <Pressable
              onPress={() => shopName ? setStep(2) : null}
              style={{
                backgroundColor: shopName ? ACCENT : C.border,
                padding: 17, borderRadius: 16, alignItems: 'center',
                flexDirection: 'row', justifyContent: 'center', gap: 10,
                shadowColor: shopName ? ACCENT : 'transparent',
                shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4,
                shadowRadius: 10, elevation: shopName ? 6 : 0,
                marginTop: 4,
              }}
            >
              <AppText style={{ color: shopName ? '#fff' : C.textSub, fontWeight: '800', fontSize: 16 }}>Next</AppText>
              <FontAwesome5 name="arrow-right" size={14} color={shopName ? '#fff' : C.textSub} />
            </Pressable>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {items.map((it, idx) => (
                <View key={idx} style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View style={{ flex: 2 }}>
                    <AuthInput label={`Item ${idx + 1}`} value={it.name} onChangeText={t => { const n = [...items]; n[idx].name = t; setItems(n); }} placeholder="e.g. Samosa" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AuthInput label="Price (₹)" value={it.price} onChangeText={t => { const n = [...items]; n[idx].price = t; setItems(n); }} keyboardType="numeric" placeholder="15" />
                  </View>
                </View>
              ))}
              <Pressable
                onPress={() => setItems([...items, { name: '', price: '' }])}
                style={{
                  padding: 16, borderStyle: 'dashed', borderWidth: 1.5,
                  borderColor: ACCENT + '50', borderRadius: 14,
                  alignItems: 'center', marginBottom: 40,
                  flexDirection: 'row', justifyContent: 'center', gap: 10,
                }}
              >
                <FontAwesome5 name="plus" size={12} color={ACCENT} />
                <AppText style={{ color: ACCENT, fontWeight: '700' }}>Add Another Item</AppText>
              </Pressable>
            </ScrollView>
            <Pressable
              onPress={handleFinish}
              disabled={loading}
              style={{
                backgroundColor: ACCENT, padding: 17, borderRadius: 16,
                alignItems: 'center', marginBottom: 20,
                flexDirection: 'row', justifyContent: 'center', gap: 10,
                shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <FontAwesome5 name="check" size={14} color="#fff" />
                    <AppText style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Finish Setup</AppText>
                  </>
              }
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
