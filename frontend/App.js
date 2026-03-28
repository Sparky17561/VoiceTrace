import { registerRootComponent } from 'expo';
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Animated, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import axios from 'axios';

// ── UPDATE THIS to your laptop's local IP (run `ipconfig` in terminal) ──
const API_BASE = 'http://192.168.102.244:8000';

// ─── Glowing Orb ─────────────────────────────────────────────────────────────
function GlowingOrb({ isRecording }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;
  const loop = useRef(null);

  useEffect(() => {
    if (isRecording) {
      loop.current = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scale, { toValue: 1.35, duration: 700, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
          ]),
        ])
      );
      loop.current.start();
    } else {
      if (loop.current) loop.current.stop();
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [isRecording]);

  return (
    <View style={orbS.wrap}>
      <Animated.View style={[orbS.ring, { transform: [{ scale }], opacity }]} />
      <View style={orbS.core} />
      <Text style={orbS.mic}>🎙</Text>
    </View>
  );
}

const orbS = StyleSheet.create({
  wrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    borderWidth: 3, borderColor: '#00ffcc',
    shadowColor: '#00ffcc', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 25, elevation: 20,
  },
  core: { position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: '#00ffcc18' },
  mic: { fontSize: 32 },
});

// ─── Confidence Badge ──────────────────────────────────────────────────────
function ConfBadge({ conf }) {
  const color = conf === 'high' ? '#00ffcc' : conf === 'medium' ? '#ffcc00' : '#ff6b6b';
  const bg = color + '22';
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: color, backgroundColor: bg, alignSelf: 'flex-start' }}>
      <Text style={{ color, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>{conf?.toUpperCase() || 'LOW'}</Text>
    </View>
  );
}

// ─── Home Screen ─────────────────────────────────────────────────────────────
function HomeScreen({ goTo }) {
  const recordingRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Tap button to start recording');
  const [result, setResult] = useState(null);

  async function toggleRecording() {
    if (loading) return;

    if (!isRecording) {
      // ── START ──
      try {
        const { status: permStatus } = await Audio.requestPermissionsAsync();
        if (permStatus !== 'granted') {
          setStatus('❌ Microphone permission denied.');
          return;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        setIsRecording(true);
        setResult(null);
        setStatus('🔴 Recording... tap again when done');
      } catch (e) {
        setStatus(`❌ Could not start: ${e.message}`);
      }
    } else {
      // ── STOP + SEND ──
      setIsRecording(false);
      setStatus('⏳ Processing...');
      try {
        await recordingRef.current.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch (e) {}
      const uri = recordingRef.current?.getURI();
      recordingRef.current = null;

      if (!uri) {
        setStatus('❌ No audio captured. Try again.');
        return;
      }
      setLoading(true);
      setStatus('🤖 Extracting data...');
      try {
        const ext = uri.split('.').pop() || 'm4a';
        let mimeType = 'audio/m4a';
        if (ext === 'caf') mimeType = 'audio/x-caf';
        else if (ext === 'wav') mimeType = 'audio/wav';
        
        const formData = new FormData();
        formData.append('audio', { uri, name: `audio.${ext}`, type: mimeType });
        
        const res = await axios.post(`${API_BASE}/process-audio`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        });
        
        setResult(res.data);
        setStatus('Tap button to start recording');
      } catch (e) {
        setStatus(`❌ ${e.message || 'Server error. Is backend running?'}`);
      } finally {
        setLoading(false);
      }
    }
  }

  const fmtAmt = (e) => {
    if (e.amount_type === 'exact' && e.value != null) return `₹${e.value}`;
    if (e.min != null && e.max != null) return `₹${e.min}–${e.max}`;
    return e.value != null ? `~₹${e.value}` : '—';
  };

  const fmtProfit = (r) => {
    if (!r) return '—';
    if (r.profit_type === 'exact' && r.profit_value != null) return `₹${r.profit_value}`;
    if (r.profit_min != null && r.profit_max != null) return `₹${r.profit_min} – ₹${r.profit_max}`;
    return '—';
  };

  return (
    <View style={s.screen}>
      {/* Top: Chat Placeholder */}
      <View style={s.chatZone}>
        <Text style={s.chatHint}>[ Chat Interface — Coming Soon ]</Text>
        <Pressable style={s.navBtn} onPress={() => goTo('dashboard')}>
          <Text style={s.navBtnTxt}>📊 Dashboard</Text>
        </Pressable>
      </View>

      {/* Orb + Button */}
      <View style={s.orbZone}>
        <GlowingOrb isRecording={isRecording} />

        <Text style={[s.statusTxt, status.startsWith('❌') && { color: '#ff6b6b' }]}>{status}</Text>

        {loading
          ? <ActivityIndicator color="#00ffcc" size="large" style={{ marginTop: 8 }} />
          : (
            <Pressable
              style={[s.recBtn, isRecording && s.recBtnActive]}
              onPress={toggleRecording}
            >
              <Text style={[s.recBtnTxt, isRecording && { color: '#fff' }]}>
                {isRecording ? '⏹  Stop & Send' : '⏺  Start Recording'}
              </Text>
            </Pressable>
          )
        }
      </View>

      {/* Result Sheet */}
      {result && (
        <ScrollView style={s.sheet} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={s.sheetTitle}>Recorded ✨</Text>
            <ConfBadge conf={result.confidence} />
          </View>

          <Text style={s.rawTxt}>"{result.raw_text}"</Text>

          <View style={s.table}>
            <View style={[s.row, s.hRow]}>
              {['Type', 'Item', 'Amount'].map(h => (
                <Text key={h} style={[s.cell, s.hCell]}>{h}</Text>
              ))}
            </View>
            {result.entries?.map((e, i) => (
              <View style={s.row} key={i}>
                <Text style={[s.cell, e.entry_type === 'REVENUE' ? s.rev : e.entry_type === 'EXPENSE' ? s.exp : s.unk]}>
                  {e.entry_type}
                </Text>
                <Text style={s.cell}>{e.item_name || '—'}</Text>
                <Text style={s.cell}>{fmtAmt(e)}</Text>
              </View>
            ))}
          </View>

          <View style={s.profitBox}>
            <Text style={s.profitLabel}>Net Profit</Text>
            <Text style={s.profitValue}>{fmtProfit(result)}</Text>
          </View>

          {result.insight && (
            <View style={s.insightBox}>
              <Text style={s.insightTxt}>💡 {result.insight}</Text>
            </View>
          )}
          {result.suggestion && (
            <View style={s.suggBox}>
              <Text style={s.suggTxt}>🎯 {result.suggestion}</Text>
            </View>
          )}

          <Pressable style={s.doneBtn} onPress={() => setResult(null)}>
            <Text style={s.doneTxt}>✅ Save & Done</Text>
          </Pressable>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────
function DashboardScreen({ goTo }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE}/entries`)
      .then(r => setEntries(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = entries.reduce((sum, e) => sum + (e.total_revenue || 0), 0);
  const totalExpense = entries.reduce((sum, e) => sum + (e.total_expense || 0), 0);

  return (
    <View style={s.screen}>
      <View style={s.dashHeader}>
        <Pressable style={s.backBtn} onPress={() => goTo('home')}>
          <Text style={s.backTxt}>← Back</Text>
        </Pressable>
        <Text style={s.dashTitle}>Dashboard</Text>
        <Pressable style={s.pdfBtn} onPress={() => axios.get(`${API_BASE}/export`).catch(() => {})}>
          <Text style={s.pdfTxt}>📄 PDF</Text>
        </Pressable>
      </View>

      <View style={s.cards}>
        <View style={[s.card, { borderColor: '#00ffcc33' }]}>
          <Text style={s.cardLabel}>Revenue</Text>
          <Text style={[s.cardValue, { color: '#00ffcc' }]}>₹{totalRevenue.toFixed(0)}</Text>
        </View>
        <View style={[s.card, { borderColor: '#ff6b6b33' }]}>
          <Text style={s.cardLabel}>Expense</Text>
          <Text style={[s.cardValue, { color: '#ff6b6b' }]}>₹{totalExpense.toFixed(0)}</Text>
        </View>
      </View>

      {loading
        ? <ActivityIndicator color="#00ffcc" style={{ marginTop: 40 }} />
        : (
          <ScrollView style={s.list}>
            <Text style={s.listHeader}>📋 LEDGER HISTORY</Text>
            {entries.length === 0
              ? <Text style={s.emptyTxt}>No entries yet. Go record something!</Text>
              : entries.map((e, i) => (
                <View style={s.entryCard} key={i}>
                  <View style={s.entryRow}>
                    <Text style={s.entryDate}>{new Date(e.created_at).toLocaleDateString()}</Text>
                    <Text style={[s.entryProfit, { color: (e.profit_value || 0) >= 0 ? '#00ffcc' : '#ff6b6b' }]}>
                      {e.profit_type === 'exact' ? `₹${e.profit_value}` : `₹${e.profit_min}–${e.profit_max}`}
                    </Text>
                  </View>
                  <Text style={s.entryText} numberOfLines={2}>{e.raw_text}</Text>
                  {e.insight ? <Text style={s.entryInsight}>💡 {e.insight}</Text> : null}
                </View>
              ))
            }
          </ScrollView>
        )}
    </View>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────
function App() {
  const [screen, setScreen] = useState('home');
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.root}>
        {screen === 'home' ? <HomeScreen goTo={setScreen} /> : <DashboardScreen goTo={setScreen} />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  screen: { flex: 1 },
  chatZone: { flex: 1, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderColor: '#151515', gap: 14 },
  chatHint: { color: '#333', fontSize: 14, fontStyle: 'italic' },
  navBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#00ffcc33' },
  navBtnTxt: { color: '#00ffcc', fontWeight: '700', fontSize: 14 },
  orbZone: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18 },
  statusTxt: { color: '#00ffcc', fontSize: 14, fontWeight: '500', textAlign: 'center', paddingHorizontal: 24 },
  recBtn: { paddingHorizontal: 36, paddingVertical: 16, borderRadius: 50, backgroundColor: '#111', borderWidth: 2, borderColor: '#00ffcc', marginTop: 4 },
  recBtnActive: { backgroundColor: '#ff3c3c', borderColor: '#ff3c3c' },
  recBtnTxt: { color: '#00ffcc', fontWeight: '700', fontSize: 16 },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '72%', backgroundColor: '#111', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, elevation: 30 },
  sheetTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  rawTxt: { color: '#555', fontStyle: 'italic', fontSize: 12, marginBottom: 16 },
  table: { borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#1a1a1a' },
  hRow: { backgroundColor: '#161616' },
  cell: { flex: 1, padding: 10, color: '#ccc', fontSize: 12 },
  hCell: { color: '#555', fontWeight: 'bold', fontSize: 11 },
  rev: { color: '#00ffcc', fontWeight: '700' },
  exp: { color: '#ff6b6b', fontWeight: '700' },
  unk: { color: '#888' },
  profitBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161616', borderRadius: 12, padding: 14, marginBottom: 12 },
  profitLabel: { color: '#888', fontSize: 13 },
  profitValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  insightBox: { backgroundColor: '#0f1f1a', borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#00ffcc' },
  insightTxt: { color: '#aaa', fontSize: 13 },
  suggBox: { backgroundColor: '#1a1508', borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#ffcc00' },
  suggTxt: { color: '#aaa', fontSize: 13 },
  doneBtn: { backgroundColor: '#00ffcc', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  doneTxt: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  dashHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#151515' },
  backBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#151515', borderRadius: 10 },
  backTxt: { color: '#00ffcc', fontWeight: '700', fontSize: 13 },
  dashTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  pdfBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#151515', borderRadius: 10 },
  pdfTxt: { color: '#aaa', fontWeight: '700', fontSize: 13 },
  cards: { flexDirection: 'row', padding: 16, gap: 12 },
  card: { flex: 1, backgroundColor: '#111', borderRadius: 14, padding: 16, borderWidth: 1 },
  cardLabel: { color: '#555', fontSize: 12, marginBottom: 6 },
  cardValue: { fontSize: 24, fontWeight: 'bold' },
  list: { flex: 1, paddingHorizontal: 16 },
  listHeader: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginVertical: 12 },
  emptyTxt: { color: '#333', textAlign: 'center', marginTop: 40, fontSize: 15 },
  entryCard: { backgroundColor: '#111', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1a1a1a' },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  entryDate: { color: '#555', fontSize: 12 },
  entryProfit: { fontSize: 14, fontWeight: 'bold' },
  entryText: { color: '#aaa', fontSize: 13, marginBottom: 4 },
  entryInsight: { color: '#555', fontSize: 11, fontStyle: 'italic' },
});

registerRootComponent(App);
