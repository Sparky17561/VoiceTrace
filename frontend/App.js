import { registerRootComponent } from 'expo';
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Animated, Pressable, 
  ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import axios from 'axios';

// ── UPDATE THIS to your laptop's local IP (run `ipconfig` in terminal) ──
const API_BASE = 'http://192.168.102.244:8000';

const getToday = () => new Date().toISOString().split('T')[0];

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
  wrap: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute', width: 90, height: 90, borderRadius: 45,
    borderWidth: 2, borderColor: '#00ffcc',
    shadowColor: '#00ffcc', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 15, elevation: 10,
  },
  core: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: '#00ffcc18' },
  mic: { fontSize: 24 },
});

// ─── Formatting Utils ────────────────────────────────────────────────────────
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

function ConfBadge({ conf }) {
  const color = conf === 'high' ? '#00ffcc' : conf === 'medium' ? '#ffcc00' : '#ff6b6b';
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: color, backgroundColor: color+'22' }}>
      <Text style={{ color, fontSize: 9, fontWeight: 'bold' }}>{conf?.toUpperCase() || 'LOW'}</Text>
    </View>
  );
}

// ─── Chat Message Bubbles ────────────────────────────────────────────────────
function ChatBubble({ msg }) {
  const isBot = msg.role === 'assistant';

  if (!isBot) {
    return (
      <View style={s.bubbleUser}>
        <Text style={s.bubbleUserTxt}>{msg.content}</Text>
      </View>
    );
  }

  if (msg.message_type === 'ledger_card' && msg.associated_session) {
    const r = msg.associated_session;
    return (
      <View style={s.bubbleBotCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: '#00ffcc', fontWeight: 'bold' }}>Ledger Saved ✅</Text>
          <ConfBadge conf={r.confidence} />
        </View>
        <Text style={{ color: '#ccc', fontStyle: 'italic', fontSize: 11, marginBottom: 8 }}>"{r.raw_text}"</Text>
        <View style={s.table}>
          <View style={[s.row, s.hRow]}>
            {['Type', 'Item', 'Amt'].map(h => <Text key={h} style={[s.cell, s.hCell]}>{h}</Text>)}
          </View>
          {r.entries?.map((e, i) => (
            <View style={s.row} key={i}>
              <Text style={[s.cell, e.entry_type === 'REVENUE' ? s.rev : s.exp, {fontSize: 10}]}>{e.entry_type.substring(0,3)}</Text>
              <Text style={s.cell}>{e.item_name || '—'}</Text>
              <Text style={[s.cell, {fontWeight:'bold'}]}>{fmtAmt(e)}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>Profit Impact: <Text style={{fontWeight:'bold'}}>{fmtProfit(r)}</Text></Text>
      </View>
    );
  }

  return (
    <View style={s.bubbleBotText}>
      <Text style={s.bubbleBotTxt}>{msg.content}</Text>
    </View>
  );
}

// ─── Chat Screen (Replaces Home) ─────────────────────────────────────────────
function ChatScreen({ currentDay, goTo, toggleSidebar }) {
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Tap & Speak');
  const recordingRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Load chat history
    axios.get(`${API_BASE}/chat/${currentDay}`)
      .then(r => {
        setMessages(r.data);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
      })
      .catch(() => {});
  }, [currentDay]);

  const toggleRecording = async () => {
    if (loading) return;
    if (!isRecording) {
      try {
        const { status: p } = await Audio.requestPermissionsAsync();
        if (p !== 'granted') { setStatus('❌ No Mic'); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        recordingRef.current = recording;
        setIsRecording(true);
        setStatus('🔴 Listening...');
      } catch (e) { setStatus('❌ Error'); }
    } else {
      setIsRecording(false);
      setStatus('⏳ Thinking...');
      try {
        await recordingRef.current.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch (e) {}
      const uri = recordingRef.current?.getURI();
      recordingRef.current = null;
      if (!uri) return;

      setLoading(true);
      const ext = uri.split('.').pop() || 'm4a';
      let mimeType = 'audio/m4a';
      if (ext === 'caf') mimeType = 'audio/x-caf';
      const formData = new FormData();
      formData.append('audio', { uri, name: `audio.${ext}`, type: mimeType });
      
      try {
        const res = await axios.post(`${API_BASE}/process-audio?day_date=${currentDay}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000
        });
        setMessages(prev => [...prev, res.data.user_message, res.data.assistant_message]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
        setStatus('Tap & Speak');
      } catch (e) {
        setStatus('❌ Server error');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={toggleSidebar} style={s.iconBtn}>
          <Text style={{color:'#fff', fontSize:20}}>☰</Text>
        </Pressable>
        <Text style={s.headerTitle}>{currentDay === getToday() ? 'Today' : currentDay}</Text>
        <Pressable onPress={() => goTo('dashboard')} style={s.iconBtn}>
          <Text style={{color:'#00ffcc', fontSize:14, fontWeight:'bold'}}>Dashboard</Text>
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} style={s.chatList} contentContainerStyle={{padding: 16, paddingBottom: 40}}>
        {messages.length === 0 ? (
          <Text style={{color:'#555', textAlign:'center', marginTop: 100}}>No messages today. Start talking to record entries or ask questions!</Text>
        ) : (
          messages.map(m => <ChatBubble key={m.id} msg={m} />)
        )}
      </ScrollView>

      <View style={s.orbFooter}>
        <GlowingOrb isRecording={isRecording} />
        <Text style={[s.orbStatus, status.startsWith('❌') && {color:'#ff6b6b'}]}>{status}</Text>
        {loading ? (
          <ActivityIndicator color="#00ffcc" size="large" />
        ) : (
          <Pressable style={s.recBtn} onPress={toggleRecording}>
            <Text style={s.recBtnTxt}>{isRecording ? "⏹ STOP" : "🎙 START"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────
function DashboardScreen({ currentDay, goTo }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Edit Modal State
  const [editEntry, setEditEntry] = useState(null);
  const [editItem, setEditItem] = useState('');
  const [editValue, setEditValue] = useState('');

  const loadData = () => {
    setLoading(true);
    axios.get(`${API_BASE}/entries?date=${currentDay}`)
      .then(r => setEntries(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [currentDay]);

  const saveEdit = async () => {
    if (!editEntry) return;
    try {
      await axios.put(`${API_BASE}/entries/${editEntry.id}`, {
        item_name: editItem,
        value: parseFloat(editValue) || 0
      });
      setEditEntry(null);
      loadData(); // refresh full list and totals
    } catch(e) {}
  };

  const totalRev = entries.reduce((s, e) => s + (e.total_revenue || 0), 0);
  const totalExp = entries.reduce((s, e) => s + (e.total_expense || 0), 0);
  
  let flatItems = [];
  entries.forEach(sess => {
    sess.entries.forEach(en => {
      flatItems.push({...en, session_created: sess.created_at});
    });
  });

  if (search.trim()) {
    flatItems = flatItems.filter(i => 
      (i.item_name || '').toLowerCase().includes(search.toLowerCase()) || 
      i.entry_type.toLowerCase().includes(search.toLowerCase())
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.dashHeader}>
        <Pressable onPress={() => goTo('chat')}><Text style={{color:'#00ffcc'}}>← Back</Text></Pressable>
        <Text style={{color:'#fff', fontWeight:'bold', fontSize: 16}}>Ledger</Text>
        <Text style={{color:'#666'}}>{currentDay}</Text>
      </View>

      <View style={s.cards}>
        <View style={s.card}>
          <Text style={s.cardLabel}>Rev</Text>
          <Text style={[s.cardValue,{color:'#00ffcc'}]}>₹{totalRev.toFixed(0)}</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardLabel}>Exp</Text>
          <Text style={[s.cardValue,{color:'#ff6b6b'}]}>₹{totalExp.toFixed(0)}</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardLabel}>Net</Text>
          <Text style={[s.cardValue,{color:'#fff'}]}>₹{(totalRev - totalExp).toFixed(0)}</Text>
        </View>
      </View>

      <TextInput 
        style={s.searchBar} 
        placeholder="Search items (e.g. banana, rent)" 
        placeholderTextColor="#555"
        value={search} onChangeText={setSearch} 
      />

      {loading ? <ActivityIndicator style={{marginTop: 40}} color="#00ffcc" /> : (
        <ScrollView style={{flex:1, paddingHorizontal: 16}}>
          {flatItems.length === 0 ? <Text style={{color:'#444', textAlign:'center', marginTop: 30}}>No records found.</Text> : 
            flatItems.map((item, idx) => (
              <Pressable 
                key={idx} 
                style={s.dashItemRow}
                onPress={() => {
                  setEditEntry(item);
                  setEditItem(item.item_name || '');
                  setEditValue(item.value ? item.value.toString() : '');
                }}
              >
                <View>
                  <Text style={{color: item.entry_type==='REVENUE'?'#00ffcc':'#ff6b6b', fontSize:11, fontWeight:'bold'}}>{item.entry_type}</Text>
                  <Text style={{color:'#ddd', fontSize:14}}>{item.item_name || 'Unnamed'}</Text>
                </View>
                <Text style={{color:'#fff', fontWeight:'bold', fontSize:16}}>₹{item.value || 0}</Text>
              </Pressable>
            ))
          }
        </ScrollView>
      )}

      {/* Edit Modal */}
      {editEntry && (
        <Modal transparent animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
            <View style={s.modalBox}>
              <Text style={{color:'#fff', fontSize: 16, fontWeight:'bold', marginBottom: 16}}>Edit Entry</Text>
              <TextInput style={s.input} placeholder="Item Name" placeholderTextColor="#666" value={editItem} onChangeText={setEditItem} />
              <TextInput style={s.input} placeholder="Amount (₹)" placeholderTextColor="#666" keyboardType="numeric" value={editValue} onChangeText={setEditValue} />
              
              <View style={{flexDirection: 'row', gap: 12, marginTop: 8}}>
                <Pressable onPress={() => setEditEntry(null)} style={[s.modalBtn, {backgroundColor: '#333'}]}>
                  <Text style={{color:'#fff'}}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveEdit} style={[s.modalBtn, {backgroundColor: '#00ffcc'}]}>
                  <Text style={{color:'#000', fontWeight:'bold'}}>Save</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

// ─── Pure JS Sidebar Sidebar System ───────────────────────────────────────────
function AppSidebar({ currentDay, setDay, close }) {
  const [days, setDays] = useState([]);
  useEffect(() => {
    axios.get(`${API_BASE}/days`).then(r => setDays(r.data)).catch(()=>{});
  }, []);

  return (
    <View style={s.sidebar}>
      <Text style={s.sbTitle}>VoiceTrace</Text>
      <ScrollView>
        {days.map(d => (
          <Pressable key={d} style={[s.sbItem, currentDay===d && s.sbItemActive]} onPress={() => {setDay(d); close();}}>
            <Text style={[s.sbItemTxt, currentDay===d && {color:'#00ffcc', fontWeight:'bold'}]}>
              {d === getToday() ? `📅 Today (${d})` : `📝 ${d}`}
            </Text>
          </Pressable>
        ))}
        <Pressable style={s.sbItem} onPress={() => {setDay(getToday()); close();}}>
          <Text style={{color:'#888'}}>+ Start New Day</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────
function App() {
  const [screen, setScreen] = useState('chat'); // 'chat' or 'dashboard'
  const [currentDay, setCurrentDay] = useState(getToday());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Animated displacement for the main content view
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: sidebarOpen ? 240 : 0, 
      duration: 250, 
      useNativeDriver: true
    }).start();
  }, [sidebarOpen]);

  return (
    <SafeAreaProvider>
      <View style={s.root}>
        {/* Background Layer: Sidebar */}
        <SafeAreaView style={{position:'absolute', top:0, bottom:0, left:0, width: 240}}>
          <AppSidebar currentDay={currentDay} setDay={setCurrentDay} close={()=>setSidebarOpen(false)} />
        </SafeAreaView>

        {/* Foreground Layer: Slid-able Main Content */}
        <Animated.View style={[s.mainContainer, { transform: [{translateX: slideAnim}] }]}>
          <SafeAreaView style={{flex:1, backgroundColor:'#0a0a0a'}}>
            {/* If sidebar is open, overlay an invisible pressable to clsoe it */}
            {sidebarOpen && <Pressable style={s.overlay} onPress={() => setSidebarOpen(false)} />}
            
            {screen === 'chat' 
              ? <ChatScreen currentDay={currentDay} goTo={setScreen} toggleSidebar={() => setSidebarOpen(true)} /> 
              : <DashboardScreen currentDay={currentDay} goTo={setScreen} />
            }
          </SafeAreaView>
        </Animated.View>
      </View>
    </SafeAreaProvider>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#121212' }, // Darker back for sidebar
  mainContainer: { flex: 1, backgroundColor: '#0a0a0a', elevation: 20, shadowColor:'#000', shadowOffset:{width:-5,height:0}, shadowOpacity:0.5 },
  overlay: { position: 'absolute', top:0, bottom:0, left:0, right:0, zIndex: 999, backgroundColor: 'rgba(0,0,0,0.5)' },
  screen: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#1c1c1c' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  iconBtn: { padding: 8 },
  chatList: { flex: 1, backgroundColor: '#050505' },
  
  // Bubbles
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: '#00ffcc22', borderWidth: 1, borderColor: '#00ffcc', padding: 12, borderRadius: 16, borderBottomRightRadius: 2, maxWidth: '80%', marginBottom: 14 },
  bubbleUserTxt: { color: '#fff', fontSize: 14 },
  bubbleBotText: { alignSelf: 'flex-start', backgroundColor: '#1a1a1a', padding: 12, borderRadius: 16, borderBottomLeftRadius: 2, maxWidth: '80%', marginBottom: 14 },
  bubbleBotTxt: { color: '#ddd', fontSize: 14 },
  bubbleBotCard: { alignSelf: 'flex-start', backgroundColor: '#111', borderWidth: 1, borderColor: '#333', padding: 14, borderRadius: 12, borderBottomLeftRadius: 2, minWidth: '85%', marginBottom: 14 },
  
  // Table inside bot card
  table: { borderWidth: 1, borderColor: '#222', borderRadius: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#1a1a1a' },
  hRow: { backgroundColor: '#1e1e1e' },
  cell: { flex: 1, padding: 8, color: '#ccc', fontSize: 11 },
  hCell: { color: '#777', fontWeight: 'bold' },
  rev: { color: '#00ffcc' }, exp: { color: '#ff6b6b' },
  
  // Orb Footer
  orbFooter: { height: 180, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24, borderTopWidth: 1, borderColor: '#1c1c1c', backgroundColor: '#0a0a0a' },
  orbStatus: { color: '#888', fontSize: 12, marginTop: 8, marginBottom: 8 },
  recBtn: { backgroundColor: '#00ffcc', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  recBtnTxt: { color: '#000', fontWeight: 'bold', fontSize: 12 },

  // Sidebar
  sidebar: { flex: 1, padding: 24, backgroundColor: '#121212' },
  sbTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 30, letterSpacing: 1 },
  sbItem: { paddingVertical: 14, borderBottomWidth: 1, borderColor: '#1a1a1a' },
  sbItemActive: { backgroundColor: '#00ffcc11', borderRadius: 8, paddingHorizontal: 10, borderColor: 'transparent' },
  sbItemTxt: { color: '#aaa', fontSize: 15 },

  // Dashboard
  dashHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#1c1c1c' },
  cards: { flexDirection: 'row', padding: 16, gap: 10 },
  card: { flex: 1, backgroundColor: '#111', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#222', alignItems: 'center' },
  cardLabel: { color: '#666', fontSize: 10, marginBottom: 4 },
  cardValue: { fontSize: 18, fontWeight: 'bold' },
  searchBar: { backgroundColor: '#1a1a1a', color: '#fff', marginHorizontal: 16, padding: 12, borderRadius: 8, marginBottom: 16 },
  dashItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#222' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '80%', backgroundColor: '#1a1a1a', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#333' },
  input: { backgroundColor: '#111', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  modalBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' }
});

export default App;
registerRootComponent(App);
