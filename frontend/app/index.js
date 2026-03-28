import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import {
  View, Text, ScrollView, Animated, Pressable,
  ActivityIndicator, TextInput, StatusBar, Alert,
  Dimensions, Platform, useColorScheme, Modal, Linking, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import i18n from '../translations';
import { AuthContext } from './_layout';

const { width: SCREEN_W } = Dimensions.get('window');
const API_BASE = 'http://192.168.102.244:8000';
const SIDEBAR_W = 300;
const getToday = () => new Date().toISOString().split('T')[0];

const AppContext = createContext();
const ThemeContext = createContext();

// ── DESIGN TOKENS ──
const ACCENT = '#1EC8A0';
const FONT_MONO = Platform.select({ ios: 'Courier New', android: 'monospace' });

const DARK = {
  bg: '#0D0F14', bgElevated: '#13161C', surface: '#181B22',
  surfaceUp: '#1F232D', border: '#252930', borderLight: '#2E3340',
  text: '#F0F4FF', textSub: '#8891A8', textFaint: '#3E4454',
  teal: '#1EC8A0', tealBg: '#1EC8A014', tealBorder: '#1EC8A030',
  rose: '#FF6B6B', roseBg: '#FF6B6B14', roseBorder: '#FF6B6B30',
  amber: '#F5A623', amberBg: '#F5A62314', amberBorder: '#F5A62330',
  indigo: '#818CF8', indigoBg: '#818CF814', indigoBorder: '#818CF830',
};
const LIGHT = {
  bg: '#F3F6FC', bgElevated: '#EBEEf6', surface: '#FFFFFF',
  surfaceUp: '#F7F9FF', border: '#E4E8F2', borderLight: '#EDF0F8',
  text: '#111827', textSub: '#5B6478', textFaint: '#B0B8CC',
  teal: '#0B9E7F', tealBg: '#0B9E7F12', tealBorder: '#0B9E7F28',
  rose: '#D94F4F', roseBg: '#D94F4F12', roseBorder: '#D94F4F28',
  amber: '#C07A10', amberBg: '#C07A1012', amberBorder: '#C07A1028',
  indigo: '#4F46E5', indigoBg: '#4F46E512', indigoBorder: '#4F46E528',
};

// ── THEME PROVIDER ──
function ThemeProvider({ children }) {
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
const useTheme = () => useContext(ThemeContext);

// ── SHARED PRIMITIVES ──
function ThemeToggle() {
  const { resolved, setMode, C } = useTheme();
  const isDark = resolved === 'dark';
  const knob = useRef(new Animated.Value(isDark ? 22 : 0)).current;
  useEffect(() => {
    Animated.spring(knob, { toValue: isDark ? 22 : 0, useNativeDriver: true, tension: 180, friction: 18 }).start();
  }, [isDark]);
  return (
    <Pressable onPress={() => setMode(isDark ? 'light' : 'dark')} hitSlop={10} style={{ width: 48, height: 26, borderRadius: 13, backgroundColor: C.surfaceUp, borderWidth: 1, borderColor: C.borderLight, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }}>
      <Animated.View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT, transform: [{ translateX: knob }], alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 10 }}>{isDark ? '🌙' : '☀️'}</Text>
      </Animated.View>
    </Pressable>
  );
}

function ConfPill({ conf }) {
  const { C } = useTheme();
  const cfg = {
    high: { bg: C.tealBg, border: C.tealBorder, color: C.teal },
    medium: { bg: C.amberBg, border: C.amberBorder, color: C.amber },
    low: { bg: C.roseBg, border: C.roseBorder, color: C.rose },
  };
  const s = cfg[conf] ?? cfg.low;
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: s.border, backgroundColor: s.bg }}>
      <Text style={{ color: s.color, fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>{(conf || 'LOW').toUpperCase()}</Text>
    </View>
  );
}

const fmtAmt = e => {
  if (e.amount_type === 'exact' && e.value != null) return `₹${e.value}`;
  if (e.min != null && e.max != null) return `₹${e.min}–${e.max}`;
  return e.value != null ? `~₹${e.value}` : '—';
};

function HamburgerBtn({ onPress, color }) {
  return (
    <Pressable onPress={onPress} hitSlop={14} style={{ gap: 5, padding: 2 }}>
      <View style={{ height: 1.5, width: 22, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ height: 1.5, width: 15, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ height: 1.5, width: 19, backgroundColor: color, borderRadius: 1 }} />
    </Pressable>
  );
}

function ScreenHeader({ title, toggleSidebar, right }) {
  const { C } = useTheme();
  const { stalls, activeStall, setActiveStall } = useContext(AppContext);
  const [showPicker, setShowPicker] = useState(false);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.surface, zIndex: 100 }}>
      <HamburgerBtn onPress={toggleSidebar} color={C.text} />
      <Pressable onPress={() => setShowPicker(true)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, marginHorizontal: 10 }}>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }} numberOfLines={1}>
          {activeStall?.name || title}
        </Text>
        {stalls.length > 1 && <Text style={{ color: C.textSub, fontSize: 11, marginTop: 1 }}>▼</Text>}
      </Pressable>
      <View style={{ width: 28, alignItems: 'flex-end' }}>{right}</View>
      <Modal visible={showPicker} transparent animationType="fade">
        <Pressable onPress={() => setShowPicker(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: C.surface, borderRadius: 28, padding: 8, borderWidth: 1, borderColor: C.border, maxHeight: '65%' }}>
            <View style={{ padding: 18, borderBottomWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.textSub, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Switch Shop</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {stalls.map(s => (
                <Pressable key={s.id} onPress={() => { setActiveStall(s); setShowPicker(false); }} style={{ padding: 18, backgroundColor: activeStall?.id === s.id ? C.tealBg : 'transparent', borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ color: C.text, fontSize: 17, fontWeight: activeStall?.id === s.id ? '800' : '600' }}>{s.name}</Text>
                  {activeStall?.id === s.id && <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>✓</Text></View>}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── AUTH ──
function AuthInput({ label, ...props }) {
  const { C } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: C.textSub, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: C.surfaceUp, color: C.text, padding: 14, borderRadius: 14, fontSize: 16, borderWidth: 1.5, borderColor: focused ? ACCENT + 'AA' : C.border }}
        placeholderTextColor={C.textFaint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
    </View>
  );
}

function AuthScreen() {
  const { login } = useContext(AuthContext);
  const { C, resolved } = useTheme();
  const [mode, setMode] = useState('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 420, useNativeDriver: true }),
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
        await axios.post(`${API_BASE}/auth/otp-request`, { phone });
        setMode('verify');
        Alert.alert('OTP Sent', 'Check server logs for your OTP.');
      } else if (mode === 'verify') {
        const r = await axios.post(`${API_BASE}/auth/otp-verify`, { phone, otp });
        login(r.data.access_token, { id: r.data.user_id, name: r.data.name, phone });
      }
    } catch (err) { Alert.alert('Error', err.response?.data?.detail || 'Authentication failed'); }
    finally { setLoading(false); }
  };

  const btnLabel = { login: 'Sign in', register: 'Create account', forgot: 'Send OTP', verify: 'Verify OTP' };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={resolved === 'dark' ? 'light-content' : 'dark-content'} />
      <Animated.View style={{ flex: 1, paddingHorizontal: 26, paddingTop: 48, opacity: fade, transform: [{ translateY: slide }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 52 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14 }}>🎙</Text>
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 }}>VoiceTrace</Text>
          </View>
          <ThemeToggle />
        </View>
        <Text style={{ color: C.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, lineHeight: 38, marginBottom: 8 }}>Business intel,{'\n'}just by speaking.</Text>
        <Text style={{ color: C.textSub, fontSize: 15, marginBottom: 36, lineHeight: 22 }}>Record your daily sales & expenses in any language.</Text>
        <View style={{ backgroundColor: C.surface, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: C.border }}>
          {mode === 'register' && <AuthInput label="Full name" value={name} onChangeText={setName} placeholder="Your name" />}
          <AuthInput label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 98765 43210" />
          {(mode === 'login' || mode === 'register') && <AuthInput label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />}
          {mode === 'verify' && <AuthInput label="6-digit OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" />}
          <Pressable onPress={handleAuth} disabled={loading} style={{ backgroundColor: ACCENT, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 4, opacity: loading ? 0.7 : 1 }}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{btnLabel[mode]}</Text>}
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 24, alignItems: 'center' }}>
          {mode === 'login' ? (
            <>
              <Pressable onPress={() => setMode('register')}><Text style={{ color: ACCENT, fontSize: 14, fontWeight: '700' }}>Create account</Text></Pressable>
              <Text style={{ color: C.textFaint }}>·</Text>
              <Pressable onPress={() => setMode('forgot')}><Text style={{ color: C.textSub, fontSize: 14 }}>Forgot password</Text></Pressable>
            </>
          ) : (
            <Pressable onPress={() => setMode('login')}><Text style={{ color: C.textSub, fontSize: 14 }}>← Back to sign in</Text></Pressable>
          )}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

// ── CHAT BUBBLE ──
function ChatBubble({ msg }) {
  const { C } = useTheme();
  const { playAudio, playingUrl } = useContext(AppContext);
  const isBot = msg.role === 'assistant';
  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 230, useNativeDriver: true }),
    ]).start();
  }, []);

  if (!isBot) {
    return (
      <Animated.View style={{ alignItems: 'flex-end', marginBottom: 10, paddingHorizontal: 16, opacity: fade, transform: [{ translateY: slideY }] }}>
        <View style={{ backgroundColor: ACCENT + '20', borderWidth: 1, borderColor: ACCENT + '40', paddingVertical: 11, paddingHorizontal: 16, borderRadius: 20, borderBottomRightRadius: 4, maxWidth: '80%' }}>
          <Text style={{ color: C.text, fontSize: 15, lineHeight: 22 }}>{msg.content}</Text>
        </View>
      </Animated.View>
    );
  }

  if (msg.message_type === 'ledger_card' && msg.associated_session) {
    const r = msg.associated_session;
    const totalRev = r.entries?.filter(e => e.entry_type === 'REVENUE').reduce((s, e) => s + (e.value || 0), 0) || 0;
    const totalExp = r.entries?.filter(e => e.entry_type !== 'REVENUE').reduce((s, e) => s + (e.value || 0), 0) || 0;
    const hasStockout = r.entries?.some(e => e.stockout_flag);
    const hasLostSales = r.entries?.some(e => e.lost_sales_flag);

    return (
      <Animated.View style={{ alignItems: 'flex-start', marginBottom: 14, paddingHorizontal: 16, opacity: fade, transform: [{ translateY: slideY }] }}>
        <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, borderBottomLeftRadius: 4, width: Math.min(SCREEN_W - 52, 360), overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.surfaceUp }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.tealBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.tealBorder }}>
                <Text style={{ color: C.teal, fontSize: 11, fontWeight: '800' }}>✓</Text>
              </View>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>Ledger Entry</Text>
            </View>
          </View>

          {r.raw_text && (
            <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.textSub, fontSize: 12, fontStyle: 'italic', lineHeight: 18 }} numberOfLines={2}>"{r.raw_text}"</Text>
            </View>
          )}

          {r.entries?.map((e, i) => {
            const isRev = e.entry_type === 'REVENUE';
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderColor: C.border + '60' }}>
                <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: isRev ? C.tealBg : C.roseBg, borderWidth: 1, borderColor: isRev ? C.tealBorder : C.roseBorder, minWidth: 34, alignItems: 'center' }}>
                  <Text style={{ color: isRev ? C.teal : C.rose, fontSize: 9, fontWeight: '800' }}>{isRev ? 'REV' : 'EXP'}</Text>
                </View>
                <Text style={{ flex: 1, color: C.text, fontSize: 14 }} numberOfLines={1}>{e.item_name || '—'}</Text>
                {e.stockout_flag && <Text style={{ fontSize: 12 }}>⚠️</Text>}
                <Text style={{ color: isRev ? C.teal : C.rose, fontSize: 14, fontWeight: '800', fontFamily: FONT_MONO }}>{fmtAmt(e)}</Text>
              </View>
            );
          })}

          {(totalRev > 0 || totalExp > 0) && (
            <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderColor: C.border }}>
              {totalRev > 0 && <Text style={{ color: C.teal, fontSize: 12, fontWeight: '700', fontFamily: FONT_MONO }}>+₹{totalRev}</Text>}
              {totalExp > 0 && <Text style={{ color: C.rose, fontSize: 12, fontWeight: '700', fontFamily: FONT_MONO }}>−₹{totalExp}</Text>}
              <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '700', fontFamily: FONT_MONO, marginLeft: 'auto' }}>Net ₹{totalRev - totalExp}</Text>
            </View>
          )}

          {hasLostSales && (
            <View style={{ backgroundColor: C.amberBg, padding: 10, borderBottomWidth: 1, borderColor: C.amberBorder }}>
              <Text style={{ color: C.amber, fontSize: 11, lineHeight: 16 }}>⚠️ Lost potential sales — item ran out with demand remaining</Text>
            </View>
          )}


          {r.audio_url && (
            <Pressable onPress={() => playAudio(r.audio_url)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 13, backgroundColor: playingUrl === r.audio_url ? ACCENT + '14' : 'transparent' }}>
              <Text style={{ fontSize: 14 }}>{playingUrl === r.audio_url ? '⏸' : '▶'}</Text>
              <Text style={{ color: C.teal, fontSize: 13, fontWeight: '600' }}>{playingUrl === r.audio_url ? 'Playing…' : 'Play Voice'}</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    );
  }

  // Action confirmation bubble
  if (msg.message_type === 'action_card') {
    return (
      <Animated.View style={{ alignItems: 'flex-start', marginBottom: 14, paddingHorizontal: 16, opacity: fade, transform: [{ translateY: slideY }] }}>
        <View style={{ backgroundColor: C.indigoBg, borderWidth: 1, borderColor: C.indigoBorder, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, borderBottomLeftRadius: 4, maxWidth: '82%' }}>
          <Text style={{ color: C.indigo, fontSize: 13, fontWeight: '700', marginBottom: 4 }}>{msg.action_icon || '✅'} Action Done</Text>
          <Text style={{ color: C.text, fontSize: 14, lineHeight: 21 }}>{msg.content}</Text>
        </View>
      </Animated.View>
    );
  }

  // Follow-up question bubble
  if (msg.message_type === 'follow_up') {
    return (
      <Animated.View style={{ alignItems: 'flex-start', marginBottom: 14, paddingHorizontal: 16, opacity: fade, transform: [{ translateY: slideY }] }}>
        <View style={{ backgroundColor: C.surface, borderWidth: 1.5, borderColor: ACCENT + '60', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, borderBottomLeftRadius: 4, maxWidth: '82%' }}>
          <Text style={{ color: ACCENT, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>🤔 Follow-up Question</Text>
          <Text style={{ color: C.text, fontSize: 14, lineHeight: 21 }}>{msg.content}</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ alignItems: 'flex-start', marginBottom: 10, paddingHorizontal: 16, opacity: fade, transform: [{ translateY: slideY }] }}>
      <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, borderBottomLeftRadius: 4, maxWidth: '82%' }}>
        <Text style={{ color: C.textSub, fontSize: 15, lineHeight: 23 }}>{msg.content}</Text>
      </View>
    </Animated.View>
  );
}


// ── ASK SCREEN (Voice Brain — Primary Interface) ──
function AskScreen({ toggleSidebar }) {
  const { token } = useContext(AuthContext);
  const { C } = useTheme();
  const { currentDay, activeStall, playAudio } = useContext(AppContext);
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Tap mic to speak');
  const [inputText, setInputText] = useState('');
  const [sessionCtx, setSessionCtx] = useState([]);
  const recordingRef = useRef(null);
  const scrollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Confirmation modal state
  const [pendingEntry, setPendingEntry] = useState(null); // { result, audio_url, day_date, stall_id }
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEditingPopup, setIsEditingPopup] = useState(false);
  const [editData, setEditData] = useState(null);

  useEffect(() => {
    if (pendingEntry && showConfirm) {
      setIsEditingPopup(false);
      setEditData(JSON.parse(JSON.stringify(pendingEntry.result.data || {})));
    }
  }, [pendingEntry, showConfirm]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.22, duration: 650, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
      ])).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [isRecording]);

  useEffect(() => {
    if (!activeStall || !token) return;
    axios.get(`${API_BASE}/chat/${currentDay}?stall_id=${activeStall.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { setMessages(r.data || []); setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 200); })
      .catch(() => { });
  }, [currentDay, activeStall]);

  const pushMsg = (role, content, type = 'text', extra = {}) => {
    const m = { id: Date.now() + Math.random(), role, content, message_type: type, ...extra };
    setMessages(prev => { const next = [...prev, m]; setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150); return next; });
    return m;
  };

  const sendToAsk = async (text) => {
    if (!text.trim() || !activeStall) return;
    pushMsg('user', text);
    const newCtx = [...sessionCtx, { role: 'user', content: text }];
    setLoading(true); setStatusMsg('Thinking…');
    try {
      const res = await axios.post(`${API_BASE}/ask`, { stall_id: activeStall.id, text: text.trim(), session_context: newCtx.slice(-6) }, { headers: { Authorization: `Bearer ${token}` } });
      const { reply, follow_up, action_taken, show_preview, result } = res.data;
      if (show_preview && result) {
        setPendingEntry({ result, audio_url: null, day_date: currentDay, stall_id: activeStall.id });
        setShowConfirm(true);
      } else {
        const botType = follow_up ? 'follow_up' : (action_taken ? 'action_card' : 'text');
        pushMsg('assistant', reply, botType);
        if (follow_up) pushMsg('assistant', follow_up, 'follow_up');
        if (action_taken) pushMsg('assistant', `✅ ${action_taken}`, 'action_card');
        setSessionCtx([...newCtx, { role: 'assistant', content: reply }]);
      }
    } catch { pushMsg('assistant', 'Sorry, something went wrong. Try again.'); }
    finally { setLoading(false); setStatusMsg('Tap mic to speak'); }
  };

  const sendTextOrTransaction = async () => {
    if (!inputText.trim() || !activeStall) return;
    const txt = inputText.trim(); setInputText('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/process-text-preview`, { text: txt, stall_id: activeStall.id, day_date: currentDay }, { headers: { Authorization: `Bearer ${token}` } });
      const { result, day_date, stall_id } = res.data;
      if (result.intent === 'query') {
        const saveRes = await axios.post(`${API_BASE}/confirm-entry`, { result, audio_url: null, day_date, stall_id }, { headers: { Authorization: `Bearer ${token}` } });
        setMessages(prev => [...prev, saveRes.data.user_message, saveRes.data.assistant_message]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
      } else {
        setPendingEntry({ result, audio_url: null, day_date, stall_id });
        setShowConfirm(true);
      }
    } catch { Alert.alert('Error', 'Failed to process'); }
    finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!pendingEntry) return;
    if (editData && pendingEntry.result) {
      pendingEntry.result.data = editData;
    }
    setShowConfirm(false);
    setLoading(true);
    try {
      const { result, audio_url, day_date, stall_id } = pendingEntry;
      const saveRes = await axios.post(`${API_BASE}/confirm-entry`, { result, audio_url, day_date, stall_id }, { headers: { Authorization: `Bearer ${token}` } });
      if (saveRes.data?.user_message && saveRes.data?.assistant_message) {
        setMessages(prev => [...prev, saveRes.data.user_message, saveRes.data.assistant_message]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
      }
    } catch (e) {
      console.error('Confirm error:', e);
      Alert.alert('Error', 'Failed to save entry. Please try again.');
    } finally { setLoading(false); setPendingEntry(null); }
  };

  const editPending = () => {
    if (!pendingEntry) return;
    const textToEdit = pendingEntry.result.raw_text || '';
    setInputText(textToEdit);
    setPendingEntry(null);
    setShowConfirm(false);
  };

  const toggleRecording = async () => {
    if (loading || !activeStall) return;
    if (!isRecording) {
      try {
        const { status: p } = await Audio.requestPermissionsAsync();
        if (p !== 'granted') { Alert.alert('Permission needed', 'Microphone access required'); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        recordingRef.current = recording;
        setIsRecording(true); setStatusMsg('Listening…');
      } catch { setStatusMsg('Microphone error'); }
    } else {
      setIsRecording(false); setStatusMsg('Processing…');
      try { await recordingRef.current.stopAndUnloadAsync(); } catch { }
      const uri = recordingRef.current?.getURI();
      recordingRef.current = null;
      if (!uri) { setStatusMsg('Tap mic to speak'); return; }
      setLoading(true);
      const fd = new FormData();
      fd.append('audio', { uri, name: 'audio.m4a', type: 'audio/m4a' });
      fd.append('stall_id', activeStall.id);
      fd.append('session_context', JSON.stringify(messages.slice(-6)));

      try {
        // REROUTE: Call /ask instead of /process-audio-preview for the Ask Tab
        const res = await axios.post(`${API_BASE}/ask`, fd, {
          headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
          timeout: 60000
        });

        const { assistant_message, user_message, show_preview, result, reply } = res.data;

        if (show_preview && result) {
          setPendingEntry({ result, audio_url: null, day_date: currentDay, stall_id: activeStall.id });
          setShowConfirm(true);
        } else if (user_message && assistant_message) {
          setMessages(prev => [...prev, user_message, assistant_message]);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
        } else if (reply) {
          pushMsg('assistant', reply);
        }

        setStatusMsg('Tap mic to speak');
      } catch (e) {
        console.error("Ask Recording Error:", e);
        setStatusMsg('Server error — try again');
      }
      finally { setLoading(false); }
    }
  };

  const cancelPending = () => {
    setPendingEntry(null);
    setShowConfirm(false);
  };


  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader title="Ask" toggleSidebar={toggleSidebar} />
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 16, paddingBottom: 20, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          {messages.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 60 }}>
              <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: ACCENT + '18', borderWidth: 1.5, borderColor: ACCENT + '35', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
                <Text style={{ fontSize: 32 }}>🎙</Text>
              </View>
              <Text style={{ color: C.text, fontSize: 21, fontWeight: '800', textAlign: 'center', marginBottom: 10, letterSpacing: -0.3 }}>Your Business Brain</Text>
              <Text style={{ color: C.textSub, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>Speak or type to log sales, track udhari, ask questions — in Hindi, Marathi, or English.</Text>
              <View style={{ marginTop: 28, gap: 10, width: '100%' }}>
                {['30 vadapav becha aaj', 'Ramu ne 200 liye udhar', 'Aaj ka profit kya tha?'].map(hint => (
                  <Pressable key={hint} onPress={() => sendToAsk(hint)} style={{ backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingVertical: 11, paddingHorizontal: 16 }}>
                    <Text style={{ color: C.textSub, fontSize: 13 }}>"{hint}"</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : messages.map((m, i) => <ChatBubble key={m.id || i} msg={m} />)}
        </ScrollView>
        <View style={{ paddingHorizontal: 14, paddingBottom: 28, paddingTop: 10, backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 32, borderWidth: 1, borderColor: C.border, paddingLeft: 18, paddingRight: 6, minHeight: 54 }}>
            <TextInput
              style={{ flex: 1, color: C.text, fontSize: 15, paddingVertical: 8 }}
              placeholder="Type or speak…"
              placeholderTextColor={C.textFaint}
              value={inputText}
              onChangeText={setInputText}
              editable={!loading}
              onSubmitEditing={sendTextOrTransaction}
              returnKeyType="send"
            />
            {inputText.length > 0 && (
              <Pressable onPress={sendTextOrTransaction} disabled={loading} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>↑</Text>
              </Pressable>
            )}
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Pressable onPress={toggleRecording} disabled={loading} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isRecording ? C.roseBg : ACCENT + '20', borderWidth: 1.5, borderColor: isRecording ? C.rose : ACCENT + '50', alignItems: 'center', justifyContent: 'center' }}>
                {loading ? <ActivityIndicator size="small" color={ACCENT} /> : <Text style={{ fontSize: 20 }}>{isRecording ? '⏹' : '🎙'}</Text>}
              </Pressable>
            </Animated.View>
          </View>
          <Text style={{ color: isRecording ? C.rose : C.textFaint, fontSize: 11, textAlign: 'center', marginTop: 8, fontWeight: '500' }}>{statusMsg}</Text>
        </View>
      </View>

      <Modal visible={showConfirm} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: 1, borderColor: C.border, maxHeight: '88%' }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {pendingEntry && (() => {
                  const r = pendingEntry.result;
                  const isUdhari = r.intent === 'udhari';
                  const entries = r.data?.entries || [];
                  const totalRev = entries.filter(e => e.entry_type === 'REVENUE').reduce((s, e) => s + (e.value || 0), 0);
                  const totalExp = entries.filter(e => e.entry_type !== 'REVENUE').reduce((s, e) => s + (e.value || 0), 0);
                  const uData = r.data || {};
                  return (
                    <View>
                      {/* Header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isUdhari ? C.indigoBg : C.tealBg, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 22 }}>{isUdhari ? '🤝' : '💰'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>{isUdhari ? 'Udhari Entry' : 'Ledger Entry'}</Text>
                          <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>Review before saving</Text>
                        </View>
                      </View>

                      {/* Transcript */}
                      {r.raw_text ? (
                        <View style={{ backgroundColor: C.surfaceUp, borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.border }}>
                          <Text style={{ color: C.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 }}>WHAT YOU SAID</Text>
                          <Text style={{ color: C.textSub, fontSize: 13, fontStyle: 'italic' }}>"{r.raw_text}"</Text>
                        </View>
                      ) : null}

                      {/* Play Audio */}
                      {pendingEntry.audio_url ? (
                        <Pressable onPress={() => playAudio(pendingEntry.audio_url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: ACCENT + '15', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: ACCENT + '30' }}>
                          <Text style={{ fontSize: 18 }}>▶</Text>
                          <Text style={{ color: ACCENT, fontWeight: '700', fontSize: 14 }}>Play Voice Recording</Text>
                        </Pressable>
                      ) : null}

                      {/* Items for transaction */}
                      {!isUdhari && entries.length > 0 ? (
                        <View style={{ backgroundColor: C.surfaceUp, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 14 }}>
                          {entries.map((e, i) => {
                            const isRev = e.entry_type === 'REVENUE';
                            return (
                              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i < entries.length - 1 ? 1 : 0, borderColor: C.border }}>
                                <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: isRev ? C.tealBg : C.roseBg, borderWidth: 1, borderColor: isRev ? C.tealBorder : C.roseBorder, marginRight: 10 }}>
                                  <Text style={{ color: isRev ? C.teal : C.rose, fontSize: 9, fontWeight: '800' }}>{isRev ? 'REV' : 'EXP'}</Text>
                                </View>
                                <Text style={{ flex: 1, color: C.text, fontSize: 14 }}>{e.item_name || e.item || '—'}</Text>
                                <Text style={{ color: isRev ? C.teal : C.rose, fontSize: 15, fontWeight: '800', fontFamily: FONT_MONO }}>₹{e.value || 0}</Text>
                              </View>
                            );
                          })}
                          {(totalRev > 0 || totalExp > 0) && (
                            <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, gap: 12, backgroundColor: C.surface }}>
                              {totalRev > 0 && <Text style={{ color: C.teal, fontSize: 12, fontWeight: '700' }}>+₹{totalRev}</Text>}
                              {totalExp > 0 && <Text style={{ color: C.rose, fontSize: 12, fontWeight: '700' }}>−₹{totalExp}</Text>}
                              <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '700', marginLeft: 'auto' }}>Net ₹{totalRev - totalExp}</Text>
                            </View>
                          )}
                        </View>
                      ) : null}

                      {/* Udhari details */}
                      {isUdhari ? (
                        <View style={{ backgroundColor: C.indigoBg, borderRadius: 14, borderWidth: 1, borderColor: C.indigoBorder, padding: 16, marginBottom: 14 }}>
                          <Text style={{ color: C.indigo, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>Credit Details</Text>
                          <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginBottom: 4 }}>👤 {uData.person_name || '—'}</Text>
                          <Text style={{ color: C.textSub, fontSize: 13 }}>Item: {uData.item || 'Not specified'}</Text>
                          <Text style={{ color: C.indigo, fontSize: 18, fontWeight: '900', fontFamily: FONT_MONO, marginTop: 8 }}>₹{uData.amount || 0}</Text>
                        </View>
                      ) : null}

                      {/* Action buttons */}
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                        <Pressable onPress={cancelPending} style={{ flex: 1, paddingVertical: 15, borderRadius: 14, backgroundColor: C.surfaceUp, alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
                          <Text style={{ color: C.textSub, fontWeight: '700', fontSize: 15 }}>✕ Cancel</Text>
                        </Pressable>
                        <Pressable onPress={handleConfirm} style={{ flex: 2, paddingVertical: 15, borderRadius: 14, backgroundColor: ACCENT, alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>✓ Confirm</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })()}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── DASHBOARD SCREEN ──
function DashboardScreen({ toggleSidebar }) {
  const { token } = useContext(AuthContext);
  const { C } = useTheme();
  const { currentDay, activeStall } = useContext(AppContext);
  const [summaries, setSummaries] = useState([]);
  const [insights, setInsights] = useState({ anomalies: [], demand_highlights: [], suggestions: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('today'); // 'today' | 'monthly'
  const [expandedDay, setExpandedDay] = useState(null);

  useEffect(() => {
    if (!activeStall || !token) return;
    setLoading(true);
    axios.get(`${API_BASE}/analytics/daily-summary?stall_id=${activeStall.id}&days=30`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        setSummaries(r.data.days || []);
        setInsights(r.data.engine_insights || { anomalies: [], demand_highlights: [], suggestions: [] });
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [currentDay, activeStall, token]);

  const todayData = summaries.find(s => s.date === currentDay) || { total_revenue: 0, total_expense: 0, profit: 0, stockout_items: [] };
  const monthlyData = summaries.reduce((acc, curr) => {
    acc.total_revenue += curr.total_revenue || 0;
    acc.total_expense += curr.total_expense || 0;
    acc.profit += curr.profit || 0;
    (curr.stockout_items || []).forEach(i => { if (!acc.stockout_items.includes(i)) acc.stockout_items.push(i); });
    return acc;
  }, { total_revenue: 0, total_expense: 0, profit: 0, stockout_items: [] });

  const activeData = tab === 'today' ? todayData : monthlyData;
  const net = activeData.profit || 0;

  // Pure JS Trend Analysis
  const detectTrend = () => {
    if (summaries.length < 3) return { type: 'stable', text: 'Need more days of data to spot trends.' };
    const recent = summaries.slice(0, 3).reduce((s, d) => s + (d.total_revenue || 0), 0) / 3;
    const past = summaries.slice(3, 6).reduce((s, d) => s + (d.total_revenue || 0), 0) / 3;
    if (past === 0) return { type: 'rising', text: 'Sales are starting to grow this week.' };
    const pct = (recent - past) / past;
    if (pct > 0.1) return { type: 'rising', text: '📈 Your sales are growing — last 3 days were stronger than before.' };
    if (pct < -0.1) return { type: 'falling', text: '📉 Sales have dipped recently — check if any items are underperforming.' };
    return { type: 'stable', text: 'Sales are steady compared to a few days ago.' };
  };

  const trend = detectTrend();

  // Weekly Patterns
  const getWeeklyPattern = () => {
    if (summaries.length < 5) return "Keep recording to unlock weekly patterns.";
    const valid = summaries.filter(s => s.total_revenue > 0);
    if (valid.length === 0) return "Not enough active days to find a pattern.";
    const bestDay = valid.sort((a, b) => b.total_revenue - a.total_revenue)[0];
    const dateObj = new Date(bestDay.date);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    return `Your best sales recently happen on ${dayName}s (₹${bestDay.total_revenue}).`;
  };

  // Stockout Alerts
  const recentStockouts = Array.from(new Set(summaries.slice(0, 4).flatMap(s => s.stockout_items || [])));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Dashboard" toggleSidebar={toggleSidebar} />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={ACCENT} size="large" /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>

          <View style={{ flexDirection: 'row', backgroundColor: C.surfaceUp, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.border }}>
            <Pressable onPress={() => setTab('today')} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: tab === 'today' ? C.surface : 'transparent', alignItems: 'center', elevation: tab === 'today' ? 2 : 0 }}><Text style={{ color: tab === 'today' ? C.text : C.textSub, fontWeight: '700' }}>Today</Text></Pressable>
            <Pressable onPress={() => setTab('monthly')} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: tab === 'monthly' ? C.surface : 'transparent', alignItems: 'center', elevation: tab === 'monthly' ? 2 : 0 }}><Text style={{ color: tab === 'monthly' ? C.text : C.textSub, fontWeight: '700' }}>Monthly (30 Days)</Text></Pressable>
          </View>

          {/* KPI SECTION */}
          {insights.anomalies?.length > 0 && (
            <View style={{ gap: 8 }}>
              {insights.anomalies.length > 2 ? (
                <View style={{ backgroundColor: C.roseBg, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.roseBorder, flexDirection: 'row', gap: 10 }}>
                  <Text>🛡️</Text>
                  <Text style={{ flex: 1, color: C.rose, fontSize: 13, fontWeight: '700' }}>
                    {insights.anomalies.length} unusual activity patterns detected this month. Check your daily breakdown for details.
                  </Text>
                </View>
              ) : (
                insights.anomalies.map((anno, idx) => (
                  <View key={idx} style={{ backgroundColor: C.roseBg, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.roseBorder, flexDirection: 'row', gap: 10 }}>
                    <Text>🛡️</Text>
                    <Text style={{ flex: 1, color: C.rose, fontSize: 13, fontWeight: '700' }}>{anno}</Text>
                  </View>
                ))
              )}
            </View>
          )}

          {activeData.stockout_items?.length > 0 && (
            <View style={{ backgroundColor: C.amberBg, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.amberBorder, flexDirection: 'row', gap: 10 }}>
              <Text>⚠️</Text>
              <Text style={{ flex: 1, color: C.amber, fontSize: 13, fontWeight: '600' }}>You ran out of {activeData.stockout_items.join(', ')} {tab === 'today' ? 'today' : 'this month'}.</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border, gap: 8 }}>
              <Text style={{ fontSize: 22 }}>📈</Text>
              <Text style={{ color: C.textSub, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>REVENUE</Text>
              <Text style={{ color: C.teal, fontSize: 22, fontWeight: '900', fontFamily: FONT_MONO }}>₹{Math.round(activeData.total_revenue || 0)}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border, gap: 8 }}>
              <Text style={{ fontSize: 22 }}>📉</Text>
              <Text style={{ color: C.textSub, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>EXPENSE</Text>
              <Text style={{ color: C.rose, fontSize: 22, fontWeight: '900', fontFamily: FONT_MONO }}>₹{Math.round(activeData.total_expense || 0)}</Text>
            </View>
          </View>

          <View style={{ backgroundColor: net >= 0 ? C.tealBg : C.roseBg, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: net >= 0 ? C.tealBorder : C.roseBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: C.textSub, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Net Profit</Text>
              <Text style={{ color: net >= 0 ? C.teal : C.rose, fontSize: 32, fontWeight: '900', fontFamily: FONT_MONO }}>{net >= 0 ? '+' : ''}₹{Math.round(net)}</Text>
            </View>
            <Text style={{ fontSize: 42 }}>{net >= 0 ? '🤑' : '😬'}</Text>
          </View>

          {/* FINANCING & GROWTH SECTION MOVED TO TOP */}
          <View style={{ gap: 16 }}>
            <View style={{ backgroundColor: C.indigoBg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.indigoBorder }}>
              <Text style={{ color: C.indigo, fontSize: 11, fontWeight: '800', marginBottom: 12 }}>🇮🇳 GOVT SCHEMES & SUPPORT</Text>
              {insights.recommended_scheme && (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 16, borderLeftWidth: 4, borderColor: C.teal }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{insights.recommended_scheme.name}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>{insights.recommended_scheme.reason}</Text>
                </View>
              )}
            </View>
            <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.textSub, fontSize: 11, fontWeight: '800', marginBottom: 12 }}>🚀 LOAN ESTIMATOR</Text>
              <Text style={{ color: C.text, fontSize: 24, fontWeight: '900' }}>₹{Math.round(monthlyData.profit * 3.5)}</Text>
              <Text style={{ color: C.teal, fontSize: 12, fontWeight: '600' }}>Estimated Credit Limit</Text>
            </View>
          </View>

          {/* DAILY BREAKDOWN */}
          <View style={{ gap: 16 }}>
            {/* Short Term */}
            <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 10 }}>📊 3-DAY TREND</Text>
              <Text style={{ color: C.text, fontSize: 15, lineHeight: 22 }}>{trend.text}</Text>
            </View>

            {/* Weekly */}
            <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 10 }}>📅 7-DAY PATTERN</Text>
              <Text style={{ color: C.text, fontSize: 15, lineHeight: 22 }}>{getWeeklyPattern()}</Text>
            </View>

            {/* Demand & Growth Insights */}
            {insights.demand_highlights?.length > 0 && (
              <View style={{ backgroundColor: C.tealBg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.tealBorder }}>
                <Text style={{ color: C.teal, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 12 }}>🚀 DEMAND & GROWTH INSIGHTS</Text>
                {insights.demand_highlights.map((h, i) => (
                  <View key={i} style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{h.item}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
                      Sold ₹{Math.round(h.observed)} but early stockout detected. Estimated true demand: <Text style={{ color: '#fff', fontWeight: '900' }}>₹{Math.round(h.estimated)}</Text>.
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontStyle: 'italic', marginTop: 2 }}>{h.reason}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Combined Growth Suggestions */}
            <View style={{ backgroundColor: C.indigoBg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.indigoBorder }}>
              <Text style={{ color: C.indigo, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 12 }}>💡 GROWTH STRATEGY (TOMORROW)</Text>
              {insights.suggestions?.map((sug, i) => (
                <View key={i} style={{ marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 12 }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{sug.suggestion}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>Reason: {sug.reason}</Text>
                </View>
              ))}
              {(!insights.suggestions || insights.suggestions.length === 0) && (
                <Text style={{ color: '#fff', fontSize: 14 }}>• Trend is stable. Keep stock levels similar to today.</Text>
              )}
            </View>
          </View>

          {/* Day Breakdown */}
          <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 12 }}>📆 DAILY BREAKDOWN</Text>
          {summaries.map((s, i) => (
            <View key={i} style={{ backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
              <Pressable onPress={() => setExpandedDay(expandedDay === i ? null : i)} style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: C.text, fontWeight: '700' }}>{s.date === currentDay ? 'Today' : s.date}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ color: s.profit >= 0 ? C.teal : C.rose, fontWeight: '700', fontFamily: FONT_MONO }}>{s.profit >= 0 ? '+' : ''}₹{Math.round(s.profit)}</Text>
                  <Text style={{ color: C.textSub, fontSize: 10 }}>{expandedDay === i ? '▲' : '▼'}</Text>
                </View>
              </Pressable>
              {expandedDay === i && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4, backgroundColor: C.surfaceUp, borderTopWidth: 1, borderColor: C.border }}>
                  {Object.keys(s.items || {}).map(itemName => {
                    const it = s.items[itemName];
                    return (
                      <View key={itemName} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ color: C.text, fontSize: 13 }}>{itemName}</Text>
                          {it.stockout && <Text style={{ fontSize: 10 }}>⚠️ zero stock</Text>}
                        </View>
                        <Text style={{ color: C.teal, fontSize: 13, fontFamily: FONT_MONO }}>₹{Math.round(it.revenue)}</Text>
                      </View>
                    );
                  })}
                  {Object.keys(s.items || {}).length === 0 && <Text style={{ color: C.textFaint, fontSize: 12, marginTop: 6 }}>No items recorded.</Text>}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ── HISTORY SCREEN (Trust & Authenticity Layer) ──
function HistoryScreen({ toggleSidebar }) {
  const { token } = useContext(AuthContext);
  const { C } = useTheme();
  const { activeStall, playAudio, playingUrl } = useContext(AppContext);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!activeStall || !token) return;
    setLoading(true);
    const ep = search.trim() ? `/search?query=${encodeURIComponent(search)}&stall_id=${activeStall.id}` : `/entries?stall_id=${activeStall.id}`;
    axios.get(`${API_BASE}${ep}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setSessions(r.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [activeStall, token, search]);

  const grouped = sessions.reduce((acc, s) => {
    const d = s.day_date || 'Unknown';
    if (!acc[d]) acc[d] = [];
    acc[d].push(s);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const handleExport = async () => {
    if (!activeStall) return;
    try {
      Alert.alert('Generating PDF…', 'Please wait a moment.');
      const res = await axios.get(`${API_BASE}/export/pdf?stall_id=${activeStall.id}&days=30`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
        timeout: 30000,
      });
      // On mobile we can't directly download — share the URL via the authenticated blob URL
      // Instead, open a download link injected with auth header via Linking or share
      // Best approach: open the URL with token as query param (server must accept it)
      Linking.openURL(`${API_BASE}/export/pdf?stall_id=${activeStall.id}&days=30&token=${token}`);
    } catch {
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    }
  };

  const daysWithData = dates.length;
  const totalRevenueAll = sessions.reduce((sum, s) => sum + (s.total_revenue || 0), 0);
  const avgDaily = daysWithData > 0 ? (totalRevenueAll / daysWithData) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title={i18n.t('auditHistory', { defaultValue: 'History & Trust' })} toggleSidebar={toggleSidebar} right={
        <Pressable onPress={handleExport} hitSlop={10} style={{ paddingLeft: 6 }}>
          <Text style={{ fontSize: 24 }}>📄</Text>
        </Pressable>
      } />

      <View style={{ marginHorizontal: 16, marginTop: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Text style={{ color: C.textSub, fontSize: 15, marginRight: 8 }}>🔍</Text>
        <TextInput
          style={{ flex: 1, color: C.text, fontSize: 15, padding: 0 }}
          placeholder="Search..."
          placeholderTextColor={C.textFaint}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && <Pressable onPress={() => setSearch('')} hitSlop={8}><Text style={{ color: C.textSub, fontSize: 18 }}>×</Text></Pressable>}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={ACCENT} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {dates.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}><Text style={{ color: C.textFaint }}>No records found.</Text></View>
          ) : dates.map(date => {
            const dayData = grouped[date];
            const dayRev = dayData.reduce((s, e) => s + (e.total_revenue || 0), 0);
            const dayExp = dayData.reduce((s, e) => s + (e.total_expense || 0), 0);
            return (
              <View key={date} style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 2 }}>
                  <Text style={{ color: C.textSub, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>{date === getToday() ? 'TODAY' : date}</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Text style={{ color: C.teal, fontSize: 12, fontWeight: '700', fontFamily: FONT_MONO }}>+₹{Math.round(dayRev)}</Text>
                    <Text style={{ color: C.rose, fontSize: 12, fontWeight: '700', fontFamily: FONT_MONO }}>−₹{Math.round(dayExp)}</Text>
                  </View>
                </View>

                {dayData.map(sess => (
                  <View key={sess.id} style={{ backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, marginBottom: 12, overflow: 'hidden' }}>
                    <View style={{ padding: 14, backgroundColor: C.surfaceUp, borderBottomWidth: 1, borderColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ backgroundColor: C.tealBg, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: C.tealBorder }}>
                          <Text style={{ color: C.teal, fontSize: 9, fontWeight: '800' }}>🔒 VERIFIED</Text>
                        </View>
                        <Text style={{ fontSize: 12 }}>{sess.audio_url ? '🎤' : '⌨️'}</Text>
                        <Text style={{ color: C.textFaint, fontSize: 11, fontFamily: FONT_MONO }}>#{sess.id.toString().padStart(6, '0')}</Text>
                      </View>
                      <Text style={{ color: C.textSub, fontSize: 11 }}>{new Date(sess.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>

                    <View style={{ padding: 14 }}>
                      {(sess.entries || []).map((e, idx) => {
                        const isRev = e.entry_type === 'REVENUE';
                        return (
                          <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isRev ? C.teal : C.rose }} />
                              <Text style={{ color: C.text, fontSize: 14 }}>{e.item_name || 'Item'}</Text>
                              {e.stockout_flag && <Text style={{ fontSize: 10 }}>⚠️</Text>}
                            </View>
                            <Text style={{ color: isRev ? C.teal : C.rose, fontSize: 14, fontWeight: '700', fontFamily: FONT_MONO }}>₹{e.value || 0}</Text>
                          </View>
                        );
                      })}
                      {sess.insight && <Text style={{ color: C.textSub, fontSize: 12, fontStyle: 'italic', marginTop: 4 }}>💬 "{sess.insight}"</Text>}

                      {sess.audio_url && (
                        <Pressable onPress={() => playAudio(sess.audio_url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: playingUrl === sess.audio_url ? ACCENT + '20' : C.bgElevated, borderRadius: 8, alignSelf: 'flex-start' }}>
                          <Text style={{ fontSize: 12 }}>{playingUrl === sess.audio_url ? '⏸' : '▶'}</Text>
                          <Text style={{ color: C.text, fontSize: 12, fontWeight: '600' }}>Play Original Audio</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ── UDHARI SCREEN (Borrow System) ──
function UdhariScreen({ toggleSidebar }) {
  const { token } = useContext(AuthContext);
  const { C } = useTheme();
  const { activeStall } = useContext(AppContext);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPerson, setExpandedPerson] = useState(null);
  const [payingId, setPayingId] = useState(null);

  const fetchUdhari = () => {
    if (!activeStall) return;
    setLoading(true);
    axios.get(`${API_BASE}/udhari?stall_id=${activeStall.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setPeople(r.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUdhari(); }, [activeStall, token]);

  const markPaid = async (entryId) => {
    Alert.alert('Mark as Paid?', 'This will mark the entry as paid and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Paid ✓', onPress: async () => {
          setPayingId(entryId);
          try {
            await axios.put(`${API_BASE}/udhari/entry/${entryId}/pay`, {}, { headers: { Authorization: `Bearer ${token}` } });
            fetchUdhari();
          } catch { Alert.alert('Error', 'Failed to mark paid'); }
          finally { setPayingId(null); }
        }
      }
    ]);
  };

  const markAllPaid = async (personId) => {
    Alert.alert('Mark All Paid?', 'All pending entries for this person will be marked paid.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Clear All', onPress: async () => {
          try {
            await axios.put(`${API_BASE}/udhari/person/${personId}/pay-all`, {}, { headers: { Authorization: `Bearer ${token}` } });
            fetchUdhari();
          } catch { Alert.alert('Error', 'Failed'); }
        }
      }
    ]);
  };

  const totalPending = people.reduce((s, p) => s + p.pending_total, 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Udhari (Borrow)" toggleSidebar={toggleSidebar} />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={ACCENT} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
          <View style={{ backgroundColor: C.roseBg, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.roseBorder, alignItems: 'center' }}>
            <Text style={{ color: C.rose, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 4 }}>TOTAL PENDING (आपले येणे)</Text>
            <Text style={{ color: C.rose, fontSize: 32, fontWeight: '900', fontFamily: FONT_MONO }}>₹{totalPending}</Text>
          </View>

          <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 10 }}>PEOPLE</Text>

          {people.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}><Text style={{ color: C.textFaint }}>No udhari records yet. Add using voice in Ask tab.</Text></View>
          ) : people.map(p => (
            <View key={p.id} style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: p.pending_total > 0 ? C.roseBorder : C.border, overflow: 'hidden' }}>
              <Pressable onPress={() => setExpandedPerson(expandedPerson === p.id ? null : p.id)} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: p.pending_total > 0 ? C.roseBg : C.tealBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: p.pending_total > 0 ? C.roseBorder : C.tealBorder }}>
                    <Text style={{ color: p.pending_total > 0 ? C.rose : C.teal, fontWeight: '800', fontSize: 16 }}>{p.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={{ color: p.pending_total > 0 ? C.rose : C.text, fontSize: 16, fontWeight: '700' }}>{p.name}</Text>
                    <Text style={{ color: p.pending_total > 0 ? C.rose : C.teal, fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                      {p.pending_total > 0 ? `Owes ₹${p.pending_total}` : 'All settled ✓'}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {p.pending_total > 0 && (
                    <Pressable onPress={() => markAllPaid(p.id)} style={{ backgroundColor: C.tealBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: C.tealBorder }}>
                      <Text style={{ color: C.teal, fontSize: 11, fontWeight: '700' }}>Clear All</Text>
                    </Pressable>
                  )}
                  <Text style={{ color: C.textSub, fontSize: 12 }}>{expandedPerson === p.id ? '▲' : '▼'}</Text>
                </View>
              </Pressable>

              {expandedPerson === p.id && (
                <View style={{ backgroundColor: C.surfaceUp, borderTopWidth: 1, borderColor: C.border }}>
                  {p.entries.length === 0 ? <Text style={{ padding: 14, color: C.textFaint }}>No history.</Text> : p.entries.map(e => {
                    const isPending = e.status === 'pending';
                    return (
                      <View key={e.id} style={{ padding: 14, borderBottomWidth: 1, borderColor: C.border + '50' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, backgroundColor: isPending ? C.roseBg : C.tealBg, borderWidth: 1, borderColor: isPending ? C.roseBorder : C.tealBorder }}>
                                <Text style={{ color: isPending ? C.rose : C.teal, fontSize: 9, fontWeight: '800' }}>{isPending ? '● PENDING' : '✓ PAID'}</Text>
                              </View>
                              <Text style={{ color: C.textFaint, fontSize: 10 }}>{new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                            </View>
                            {e.item ? (
                              <>
                                <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>📦 {e.item}</Text>
                                <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>Total: <Text style={{ color: isPending ? C.rose : C.teal, fontWeight: '700', fontFamily: FONT_MONO }}>₹{e.amount}</Text></Text>
                              </>
                            ) : (
                              <Text style={{ color: C.text, fontSize: 14 }}>Cash Udhari: <Text style={{ color: isPending ? C.rose : C.teal, fontWeight: '700', fontFamily: FONT_MONO }}>₹{e.amount}</Text></Text>
                            )}
                          </View>
                          {isPending && (
                            <Pressable onPress={() => markPaid(e.id)} disabled={payingId === e.id} style={{ backgroundColor: C.tealBg, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.tealBorder, marginLeft: 10 }}>
                              {payingId === e.id ? <ActivityIndicator size="small" color={C.teal} /> : <Text style={{ color: C.teal, fontSize: 12, fontWeight: '700' }}>Mark Paid</Text>}
                            </Pressable>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}


// ── SHOPS SCREEN (Manage Stalls & Menus) ──
function ShopsScreen({ toggleSidebar }) {
  const { token } = useContext(AuthContext);
  const { C, resolved } = useTheme();
  const { activeStall, setActiveStall, setStalls } = useContext(AppContext);
  const [localStalls, setLocalStalls] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showStallModal, setShowStallModal] = useState(false);
  const [stallForm, setStallForm] = useState({ id: null, name: '', location: '' });

  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuForm, setMenuForm] = useState({ stallId: null, itemId: null, name: '', price: '' });

  const fetchStalls = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/stalls`, { headers: { Authorization: `Bearer ${token}` } });
      setLocalStalls(res.data);
      setStalls(res.data);
      if (res.data.length > 0 && !activeStall) {
        setActiveStall(res.data[0]);
      }
    } catch { Alert.alert('Error', 'Failed to load shops'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStalls(); }, [token]);

  const saveStall = async () => {
    if (!stallForm.name) return Alert.alert('Error', 'Shop name required');
    try {
      if (stallForm.id) {
        await axios.put(`${API_BASE}/stalls/${stallForm.id}`, stallForm, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${API_BASE}/stalls`, stallForm, { headers: { Authorization: `Bearer ${token}` } });
      }
      setShowStallModal(false);
      fetchStalls();
    } catch { Alert.alert('Error', 'Failed to save shop'); }
  };

  const deleteStall = (id) => {
    Alert.alert('Confirm', 'Delete this shop and all its data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await axios.delete(`${API_BASE}/stalls/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            if (activeStall?.id === id) setActiveStall(null);
            fetchStalls();
          } catch { Alert.alert('Error', 'Failed to delete'); }
        }
      }
    ]);
  };

  const saveMenu = async () => {
    if (!menuForm.name || !menuForm.price) return Alert.alert('Error', 'Name and price required');
    try {
      const payload = { item_name: menuForm.name, price_per_unit: parseFloat(menuForm.price) };
      if (menuForm.itemId) {
        await axios.put(`${API_BASE}/menu/${menuForm.itemId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${API_BASE}/stalls/${menuForm.stallId}/menu`, payload, { headers: { Authorization: `Bearer ${token}` } });
      }
      setShowMenuModal(false);
      fetchStalls();
    } catch { Alert.alert('Error', 'Failed to save item'); }
  };

  const deleteMenu = (itemId) => {
    Alert.alert('Confirm', 'Remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await axios.delete(`${API_BASE}/menu/${itemId}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchStalls();
          } catch { Alert.alert('Error', 'Failed to delete item'); }
        }
      }
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title={i18n.t('myShops', { defaultValue: 'My Shops' })} toggleSidebar={toggleSidebar} right={
        <Pressable onPress={() => { setStallForm({ id: null, name: '', location: '' }); setShowStallModal(true); }} hitSlop={10} style={{ paddingLeft: 6 }}>
          <Text style={{ fontSize: 24 }}>➕</Text>
        </Pressable>
      } />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={ACCENT} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {localStalls.map(stall => (
            <View key={stall.id} style={{ backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, marginBottom: 20, overflow: 'hidden' }}>
              <View style={{ padding: 16, backgroundColor: activeStall?.id === stall.id ? C.tealBg : C.surfaceUp, borderBottomWidth: 1, borderColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 18, fontWeight: '800' }}>{stall.name} {activeStall?.id === stall.id && '✅'}</Text>
                  {stall.location && <Text style={{ color: C.textSub, fontSize: 13, marginTop: 4 }}>📍 {stall.location}</Text>}
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Pressable onPress={() => { setStallForm({ id: stall.id, name: stall.name, location: stall.location || '' }); setShowStallModal(true); }}><Text style={{ fontSize: 18 }}>✏️</Text></Pressable>
                  <Pressable onPress={() => deleteStall(stall.id)}><Text style={{ fontSize: 18 }}>🗑️</Text></Pressable>
                </View>
              </View>

              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>MENU ITEMS</Text>
                  <Pressable onPress={() => { setMenuForm({ stallId: stall.id, itemId: null, name: '', price: '' }); setShowMenuModal(true); }} style={{ backgroundColor: C.bgElevated, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>+ Add Item</Text>
                  </Pressable>
                </View>

                {stall.menu_items?.length === 0 ? (
                  <Text style={{ color: C.textFaint, fontSize: 13, fontStyle: 'italic' }}>No items added yet.</Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {stall.menu_items?.map(item => (
                      <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.bg, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: C.border }}>
                        <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }}>{item.item_name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                          <Text style={{ color: C.teal, fontSize: 15, fontWeight: '800', fontFamily: FONT_MONO }}>₹{item.price_per_unit}</Text>
                          <Pressable onPress={() => { setMenuForm({ stallId: stall.id, itemId: item.id, name: item.item_name, price: item.price_per_unit.toString() }); setShowMenuModal(true); }}><Text style={{ fontSize: 16 }}>✏️</Text></Pressable>
                          <Pressable onPress={() => deleteMenu(item.id)}><Text style={{ fontSize: 16 }}>❌</Text></Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Shop Modal */}
      <Modal visible={showStallModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }}>
          <View style={{ backgroundColor: C.surface, borderRadius: 24, margin: 24, padding: 24, paddingBottom: 32 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 20 }}>{stallForm.id ? 'Edit Shop' : 'Add Shop'}</Text>
            <AuthInput label="Shop Name" value={stallForm.name} onChangeText={t => setStallForm({ ...stallForm, name: t })} placeholder="e.g. Raju Vadapav" />
            <AuthInput label="Location (Optional)" value={stallForm.location} onChangeText={t => setStallForm({ ...stallForm, location: t })} placeholder="e.g. Bandra East" />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <Pressable onPress={() => setShowStallModal(false)} style={{ flex: 1, padding: 16, borderRadius: 14, backgroundColor: C.bgElevated, alignItems: 'center' }}>
                <Text style={{ color: C.textSub, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveStall} style={{ flex: 1, padding: 16, borderRadius: 14, backgroundColor: ACCENT, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Save Shop</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Menu Item Modal */}
      <Modal visible={showMenuModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }}>
          <View style={{ backgroundColor: C.surface, borderRadius: 24, margin: 24, padding: 24, paddingBottom: 32 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 20 }}>{menuForm.itemId ? 'Edit Item' : 'Add Item'}</Text>
            <AuthInput label="Item Name" value={menuForm.name} onChangeText={t => setMenuForm({ ...menuForm, name: t })} placeholder="e.g. Samosa" />
            <AuthInput label="Price (₹)" value={menuForm.price} onChangeText={t => setMenuForm({ ...menuForm, price: t })} keyboardType="numeric" placeholder="e.g. 15" />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <Pressable onPress={() => setShowMenuModal(false)} style={{ flex: 1, padding: 16, borderRadius: 14, backgroundColor: C.bgElevated, alignItems: 'center' }}>
                <Text style={{ color: C.textSub, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveMenu} style={{ flex: 1, padding: 16, borderRadius: 14, backgroundColor: C.teal, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Save Item</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

// ── APP SIDEBAR ──
function AppSidebar({ currentRoute, setRoute, close, logout }) {
  const { C } = useTheme();
  const menu = [
    { id: 'ask', icon: '🎙', label: i18n.t('askTab', { defaultValue: 'Ask' }) },
    { id: 'dashboard', icon: '📊', label: i18n.t('dashboard', { defaultValue: 'Dashboard' }) },
    { id: 'udhari', icon: '🤝', label: i18n.t('udhari', { defaultValue: 'Udhari' }) },
    { id: 'history', icon: '🗓', label: i18n.t('history', { defaultValue: 'History' }) },
    { id: 'shops', icon: '🏪', label: i18n.t('shops', { defaultValue: 'My Shops' }) },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: C.surface, paddingTop: 60, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
        <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>VoiceTrace</Text>
        <ThemeToggle />
      </View>
      <View style={{ gap: 8, flex: 1 }}>
        {menu.map(m => {
          const active = currentRoute === m.id;
          return (
            <Pressable key={m.id} onPress={() => { setRoute(m.id); close(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: active ? C.tealBg : 'transparent' }}>
              <Text style={{ fontSize: 22 }}>{m.icon}</Text>
              <Text style={{ color: active ? C.teal : C.text, fontSize: 17, fontWeight: active ? '800' : '600' }}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={logout} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 30 }}>
        <Text style={{ fontSize: 22 }}>🚪</Text>
        <Text style={{ color: C.rose, fontSize: 17, fontWeight: '700' }}>{i18n.t('logout', { defaultValue: 'Log out' })}</Text>
      </Pressable>
    </View>
  );
}

// ── ONBOARDING SCREEN ──
function OnboardingScreen({ token, onComplete }) {
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ padding: 24, flex: 1, justifyContent: 'center' }}>
        <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', marginBottom: 10 }}>{step === 1 ? 'Welcome! 👋' : 'Add Menu Items 🍜'}</Text>
        <Text style={{ color: C.textSub, fontSize: 16, marginBottom: 40 }}>
          {step === 1 ? "Let's set up your first shop." : "What do you sell here? We'll use this to calculate prices automatically when you speak."}
        </Text>

        {step === 1 ? (
          <View style={{ backgroundColor: C.surface, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: C.border }}>
            <AuthInput label="Shop Name" value={shopName} onChangeText={setShopName} placeholder="e.g. Raju Vadapav" />
            <Pressable onPress={() => shopName ? setStep(2) : null} style={{ backgroundColor: shopName ? ACCENT : C.border, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 }}>
              <Text style={{ color: shopName ? '#fff' : C.textSub, fontWeight: '800', fontSize: 16 }}>Next →</Text>
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
              <Pressable onPress={() => setItems([...items, { name: '', price: '' }])} style={{ padding: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: C.teal, borderRadius: 12, alignItems: 'center', marginBottom: 40 }}>
                <Text style={{ color: C.teal, fontWeight: '700' }}>+ Add Another Item</Text>
              </Pressable>
            </ScrollView>
            <Pressable onPress={handleFinish} disabled={loading} style={{ backgroundColor: ACCENT, padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 20 }}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Finish Setup 🎉</Text>}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── MAIN APP INNER (State & Routing) ──
function MainAppInner() {
  const { user, token, logout } = useContext(AuthContext);
  const { resolved } = useTheme();
  const [route, setRoute] = useState('ask');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Global Context
  const [stalls, setStalls] = useState([]);
  const [activeStall, setActiveStall] = useState(null);
  const [currentDay, setCurrentDay] = useState(getToday());
  const [playingUrl, setPlayingUrl] = useState(null);
  const soundRef = useRef(null);

  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setInitLoading(true);
    axios.get(`${API_BASE}/onboarding/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const isNeeded = !res.data.completed;
        setNeedsOnboarding(isNeeded);
        if (!isNeeded) {
          axios.get(`${API_BASE}/stalls`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => {
              setStalls(r.data);
              if (r.data.length > 0 && !activeStall) setActiveStall(r.data[0]);
            }).catch(() => { });
        }
      })
      .catch(() => { })
      .finally(() => setInitLoading(false));
  }, [token]);

  const toggleSidebar = () => {
    const to = sidebarOpen ? 0 : 1;
    setSidebarOpen(!sidebarOpen);
    Animated.spring(slideAnim, { toValue: to, useNativeDriver: true, tension: 250, friction: 30 }).start();
  };

  const playAudio = async (url) => {
    try {
      if (soundRef.current) await soundRef.current.unloadAsync();
      if (playingUrl === url) { setPlayingUrl(null); return; }
      setPlayingUrl(url);
      const { sound } = await Audio.Sound.createAsync({ uri: url });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate(s => { if (s.didJustFinish) setPlayingUrl(null); });
      await sound.playAsync();
    } catch { Alert.alert('Playback Error', 'Could not play audio'); setPlayingUrl(null); }
  };

  if (initLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: resolved === 'dark' ? '#0a0a0a' : '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#1EC8A0" size="large" />
      </View>
    );
  }

  if (needsOnboarding) {
    return <OnboardingScreen token={token} onComplete={() => setNeedsOnboarding(false)} />;
  }

  const Page = {
    ask: AskScreen,
    dashboard: DashboardScreen,
    udhari: UdhariScreen,
    history: HistoryScreen,
    shops: ShopsScreen,
  }[route] || AskScreen;

  return (
    <AppContext.Provider value={{
      stalls, setStalls, activeStall, setActiveStall,
      currentDay, setCurrentDay,
      playAudio, playingUrl
    }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: resolved === 'dark' ? DARK.surface : LIGHT.surface }}>
        <StatusBar barStyle={resolved === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {/* Sidebar Background Layer */}
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: SIDEBAR_W, zIndex: 1 }}>
            <AppSidebar currentRoute={route} setRoute={setRoute} close={toggleSidebar} logout={logout} />
          </View>
          {/* Main Content Layer (Slides right) */}
          <Animated.View style={{ flex: 1, backgroundColor: resolved === 'dark' ? DARK.bg : LIGHT.bg, zIndex: 2, transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, SIDEBAR_W] }) }], borderRadius: sidebarOpen ? 30 : 0, overflow: 'hidden', elevation: sidebarOpen ? 20 : 0, shadowColor: '#000', shadowOffset: { width: -10, height: 0 }, shadowOpacity: 0.15, shadowRadius: 20 }}>
            {/* Dark Overlay when open */}
            {sidebarOpen && (
              <Pressable onPress={toggleSidebar} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 999, backgroundColor: 'rgba(0,0,0,0.3)' }} />
            )}
            <Page toggleSidebar={toggleSidebar} />
          </Animated.View>
        </View>
      </SafeAreaView>
    </AppContext.Provider>
  );
}

// ── APP ROOT ──
export default function MainApp() {
  const { token } = useContext(AuthContext);
  return (
    <ThemeProvider>
      {token ? <MainAppInner /> : <AuthScreen />}
    </ThemeProvider>
  );
}