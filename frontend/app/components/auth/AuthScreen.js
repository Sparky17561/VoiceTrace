import React, { useState, useRef, useEffect, useContext } from 'react';
import AppText from '../core/AppText';
import { View, Text, Animated, Pressable, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import { AuthContext } from '../../_layout';
import { useTheme, ACCENT } from '../core/theme';
import { API_BASE } from '../utils/constants';
import { ThemeToggle, AuthInput } from '../shared';

export default function AuthScreen() {
  const { login } = useContext(AuthContext);
  const { C, resolved } = useTheme();
  const [mode, setMode] = useState('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleAuth = async () => {
    setLoading(true);
    try {
      if (mode === 'login') {
        const r = await axios.post(`${API_BASE}/auth/login`, { phone, password });
        login(r.data.access_token, { id: r.data.user_id, name: r.data.name, phone, needs_onboarding: r.data.needs_onboarding });
      } else if (mode === 'register') {
        const r = await axios.post(`${API_BASE}/auth/register`, { phone, password, name });
        login(r.data.access_token, { id: r.data.user_id, name: r.data.name, phone, needs_onboarding: true });
      } else if (mode === 'forgot') {
        const res = await axios.post(`${API_BASE}/auth/otp-request`, { phone });
        setMode('verify');
        Alert.alert('OTP Sent', res.data.message || 'Check your phone or server logs for OTP.');
      } else if (mode === 'verify') {
        await axios.post(`${API_BASE}/auth/reset-password`, { phone, otp, new_password: password });
        Alert.alert('Success', 'Password reset successfully. Please sign in with your new password.');
        setMode('login');
        setPassword('');
        setOtp('');
      }
    } catch (err) { Alert.alert('Error', err.response?.data?.detail || 'Authentication failed'); }
    finally { setLoading(false); }
  };

  const btnLabel = { login: 'Sign In', register: 'Create Account', forgot: 'Send OTP', verify: 'Reset Password' };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={resolved === 'dark' ? 'light-content' : 'dark-content'} />
      <Animated.View style={{ flex: 1, paddingHorizontal: 26, paddingTop: 36, opacity: fade, transform: [{ translateY: slide }] }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 56 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: ACCENT,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
            }}>
              <FontAwesome5 name="microphone" size={18} color="#fff" />
            </View>
            <AppText style={{ color: C.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 }}>VoiceTrace</AppText>
          </View>
          <ThemeToggle />
        </View>

        {/* Hero text */}
        <AppText style={{ color: C.text, fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 40, marginBottom: 10 }}>
          Business intel,{'\n'}just by speaking.
        </AppText>
        <AppText style={{ color: C.textSub, fontSize: 15, marginBottom: 40, lineHeight: 24 }}>
          Record sales & expenses in Hindi, Marathi, or English.
        </AppText>

        {/* Form card */}
        <View style={{
          backgroundColor: C.surface, borderRadius: 24, padding: 22,
          borderWidth: 1, borderColor: C.border,
          shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12, shadowRadius: 24, elevation: 6,
        }}>
          {mode === 'register' && <AuthInput label="Full name" value={name} onChangeText={setName} placeholder="Your name" />}
          <AuthInput label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 98765 43210" />
          {(mode === 'login' || mode === 'register' || mode === 'verify') && (
            <AuthInput label={mode === 'verify' ? 'New Password' : 'Password'} value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
          )}
          {mode === 'verify' && (
            <AuthInput label="6-digit OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" placeholder="123456" />
          )}

          <Pressable
            onPress={handleAuth}
            disabled={loading}
            style={{
              backgroundColor: ACCENT, paddingVertical: 17, borderRadius: 16,
              alignItems: 'center', marginTop: 6, opacity: loading ? 0.7 : 1,
              shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
            }}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <AppText style={{ color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 }}>{btnLabel[mode]}</AppText>
            }
          </Pressable>
        </View>

        {/* Links */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 28, alignItems: 'center' }}>
          {mode === 'login' ? (
            <>
              <Pressable onPress={() => setMode('register')}>
                <AppText style={{ color: ACCENT, fontSize: 14, fontWeight: '700' }}>Create account</AppText>
              </Pressable>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.textFaint }} />
              <Pressable onPress={() => setMode('forgot')}>
                <AppText style={{ color: C.textSub, fontSize: 14 }}>Forgot password</AppText>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={() => { setMode('login'); setPassword(''); setOtp(''); }}>
              <AppText style={{ color: C.textSub, fontSize: 14 }}>← Back to sign in</AppText>
            </Pressable>
          )}
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}
