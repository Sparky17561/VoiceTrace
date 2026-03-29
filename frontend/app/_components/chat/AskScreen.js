import React, { useState, useRef, useEffect, useContext } from 'react';
import AppText from '../core/AppText';
import {
  View, Text, ScrollView, Animated, Pressable,
  ActivityIndicator, TextInput, Alert,
  Platform, Modal, KeyboardAvoidingView
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import axios from 'axios';
import { AuthContext } from '../../_layout';
import { useTheme, ACCENT, FONT_MONO } from '../core/theme';
import { AppContext } from '../core/AppContext';
import { API_BASE } from '../utils/constants';
import { ScreenHeader } from '../shared';
import ChatBubble from './ChatBubble';
import i18n from '../../../translations';

export default function AskScreen({ toggleSidebar }) {
  const { token } = useContext(AuthContext);
  const { C } = useTheme();
  const { currentDay, activeStall, playAudio, playingUrl } = useContext(AppContext);
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Tap to speak');
  const [inputText, setInputText] = useState('');
  const [sessionCtx, setSessionCtx] = useState([]);
  const recordingRef = useRef(null);
  const scrollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  const [pendingEntry, setPendingEntry] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [recordSecs, setRecordSecs] = useState(0);

  useEffect(() => {
    if (pendingEntry && showConfirm) {
      setEditData(JSON.parse(JSON.stringify(pendingEntry.result.data || {})));
    }
  }, [pendingEntry, showConfirm]);

  // Pulse animation for idle mic
  useEffect(() => {
    if (isRecording) {
      // Fast active pulse
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.22, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])).start();
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])).start();
    } else {
      // Slow idle breathe
      pulseAnim.stopAnimation();
      glowAnim.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.timing(glowAnim, { toValue: 0.4, duration: 300, useNativeDriver: true }).start();
    }
    
    // Timer logic
    let interval;
    if (isRecording) {
      setRecordSecs(0);
      interval = setInterval(() => setRecordSecs(s => s + 1), 1000);
    } else {
      setRecordSecs(0);
    }
    return () => clearInterval(interval);
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
        if (action_taken) pushMsg('assistant', `${action_taken}`, 'action_card');
        setSessionCtx([...newCtx, { role: 'assistant', content: reply }]);
      }
    } catch { pushMsg('assistant', 'Sorry, something went wrong. Try again.'); }
    finally { setLoading(false); setStatusMsg('Tap to speak'); }
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
    if (editData && pendingEntry.result) { pendingEntry.result.data = editData; }
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
      Alert.alert('Error', 'Failed to save entry. Please try again.');
    } finally { setLoading(false); setPendingEntry(null); }
  };

  const cancelPending = () => { setPendingEntry(null); setShowConfirm(false); };

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
      if (!uri) { setStatusMsg('Tap to speak'); return; }
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
        const { assistant_message, user_message, show_preview, result, reply, audio_url: returnedAudioUrl } = res.data;
        if (show_preview && result) {
          setPendingEntry({ result, audio_url: returnedAudioUrl || null, day_date: currentDay, stall_id: activeStall.id });
          setShowConfirm(true);
        } else if (user_message && assistant_message) {
          setMessages(prev => [...prev, user_message, assistant_message]);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
        } else if (reply) {
          pushMsg('assistant', reply);
        }
        setStatusMsg('Tap to speak');
      } catch (e) {
        console.error("Ask Recording Error:", e);
        setStatusMsg('Server error — try again');
      }
      finally { setLoading(false); }
    }
  };

  const hints = ['30 vadapav becha aaj', 'Ramu ne 200 liye udhar', 'Aaj ka profit kya tha?'];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader title="Ask" toggleSidebar={toggleSidebar} />

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 20, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            /* ── Empty state — centered voice CTA ── */
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 40 }}>
              {/* Glow rings behind mic */}
              <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
                <Animated.View style={{
                  position: 'absolute',
                  width: 140, height: 140, borderRadius: 70,
                  backgroundColor: ACCENT + '10',
                  transform: [{ scale: pulseAnim }],
                }} />
                <View style={{
                  width: 100, height: 100, borderRadius: 50,
                  backgroundColor: ACCENT + '18',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1.5, borderColor: ACCENT + '35',
                  shadowColor: ACCENT, shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
                }}>
                  <FontAwesome5 name="microphone" size={38} color={ACCENT} />
                </View>
              </View>

              <AppText style={{ color: C.text, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 10, letterSpacing: -0.3 }}>
                {i18n.t('businessBrain', { defaultValue: 'Your Business Brain' })}
              </AppText>
              <AppText style={{ color: C.textSub, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
                {i18n.t('businessBrainSub', { defaultValue: 'Speak or type to log sales, track udhari,\nask questions in any language.' })}
              </AppText>

              {/* Hint chips */}
              <View style={{ gap: 10, width: '100%' }}>
                {hints.map(hint => (
                  <Pressable
                    key={hint}
                    onPress={() => sendToAsk(hint)}
                    style={{
                      backgroundColor: C.surface, borderRadius: 14,
                      borderWidth: 1, borderColor: C.border,
                      paddingVertical: 13, paddingHorizontal: 18,
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                    }}
                  >
                    <FontAwesome5 name="comment-alt" size={12} color={C.textFaint} />
                    <AppText style={{ color: C.textSub, fontSize: 13 }}>"{hint}"</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            messages.map((m, i) => <ChatBubble key={m.id || i} msg={m} />)
          )}
        </ScrollView>

        {/* ── Input Bar ── */}
        <View style={{
          paddingHorizontal: 14, paddingBottom: 28, paddingTop: 10,
          backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.border,
        }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: C.surface, borderRadius: 32,
            borderWidth: 1, borderColor: C.border,
            paddingLeft: 18, paddingRight: 6, minHeight: 56,
          }}>
            {isRecording ? (
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.rose, marginRight: 8 }} />
                <AppText style={{ color: C.rose, fontSize: 15, fontWeight: '700', fontFamily: FONT_MONO }}>
                  {Math.floor(recordSecs / 60).toString().padStart(2, '0')}:{(recordSecs % 60).toString().padStart(2, '0')}
                </AppText>
              </View>
            ) : (
              <TextInput
                style={{ flex: 1, color: C.text, fontSize: 15, paddingVertical: 8 }}
                placeholder={i18n.t('typeOrSpeak', { defaultValue: 'Type or speak...' })}
                placeholderTextColor={C.textFaint}
                value={inputText}
                onChangeText={setInputText}
                editable={!loading}
                onSubmitEditing={sendTextOrTransaction}
                returnKeyType="send"
              />
            )}
            {inputText.length > 0 && (
              <Pressable
                onPress={sendTextOrTransaction}
                disabled={loading}
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginRight: 6,
                  shadowColor: ACCENT, shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.5, shadowRadius: 8, elevation: 4,
                }}
              >
                <FontAwesome5 name="paper-plane" size={15} color="#fff" />
              </Pressable>
            )}
            {/* Mic button */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Pressable
                onPress={toggleRecording}
                disabled={loading}
                style={{
                  width: 46, height: 46, borderRadius: 23,
                  backgroundColor: isRecording ? C.roseBg : ACCENT + '20',
                  borderWidth: 1.5,
                  borderColor: isRecording ? C.rose : ACCENT + '60',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: isRecording ? C.rose : ACCENT,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: isRecording ? 0.6 : 0.3,
                  shadowRadius: isRecording ? 10 : 6,
                  elevation: isRecording ? 6 : 3,
                }}
              >
                {loading
                  ? <ActivityIndicator size="small" color={ACCENT} />
                  : <FontAwesome5 name={isRecording ? 'stop' : 'microphone'} size={18} color={isRecording ? C.rose : ACCENT} />
                }
              </Pressable>
            </Animated.View>
          </View>
          <AppText style={{
            color: isRecording ? C.rose : C.textFaint,
            fontSize: 11, textAlign: 'center', marginTop: 8, fontWeight: '500', letterSpacing: 0.3,
          }}>
            {isRecording ? i18n.t('listening', { defaultValue: 'Listening...' }) : loading ? i18n.t('processing', { defaultValue: 'Processing...' }) : i18n.t('tapToSpeak', { defaultValue: 'Tap to speak' })}
          </AppText>
        </View>
      </View>

      {/* ── Confirm Modal ── */}
      <Modal visible={showConfirm} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
            <View style={{
              backgroundColor: C.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30,
              padding: 24, borderWidth: 1, borderColor: C.border, maxHeight: '88%',
            }}>
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 }}>
                        <View style={{
                          width: 48, height: 48, borderRadius: 16,
                          backgroundColor: isUdhari ? C.indigoBg : C.tealBg,
                          alignItems: 'center', justifyContent: 'center',
                          borderWidth: 1, borderColor: isUdhari ? C.indigoBorder : C.tealBorder,
                        }}>
                          <FontAwesome5 name={isUdhari ? 'hands-helping' : 'receipt'} size={20} color={isUdhari ? C.indigo : C.teal} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>
                            {isUdhari ? 'Udhari Entry' : 'Ledger Entry'}
                          </AppText>
                          <AppText style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>Review before saving</AppText>
                        </View>
                      </View>

                      {/* Transcript */}
                      {r.raw_text ? (
                        <View style={{ backgroundColor: C.surfaceUp, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border }}>
                          <AppText style={{ color: C.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 5 }}>WHAT YOU SAID</AppText>
                          <AppText style={{ color: C.textSub, fontSize: 13, fontStyle: 'italic' }}>"{r.raw_text}"</AppText>
                        </View>
                      ) : null}

                      {/* Audio player */}
                      {pendingEntry.audio_url ? (
                        <Pressable onPress={() => playAudio(pendingEntry.audio_url)} style={{
                          flexDirection: 'row', alignItems: 'center', gap: 12,
                          backgroundColor: playingUrl === pendingEntry.audio_url ? ACCENT + '30' : ACCENT + '15', 
                          borderRadius: 14, padding: 14,
                          marginBottom: 14, borderWidth: 1, 
                          borderColor: playingUrl === pendingEntry.audio_url ? ACCENT + '60' : ACCENT + '30',
                        }}>
                          <FontAwesome5 name={playingUrl === pendingEntry.audio_url ? "pause" : "play"} size={14} color={ACCENT} />
                          <AppText style={{ color: ACCENT, fontWeight: '700', fontSize: 14 }}>
                            {playingUrl === pendingEntry.audio_url ? "Playing…" : "Play Voice Recording"}
                          </AppText>
                        </Pressable>
                      ) : null}

                      {/* Transaction items */}
                      {!isUdhari && entries.length > 0 ? (
                        <View style={{
                          backgroundColor: C.surfaceUp, borderRadius: 16,
                          borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 14,
                        }}>
                          {entries.map((e, i) => {
                            const isRev = e.entry_type === 'REVENUE';
                            return (
                              <View key={i} style={{
                                flexDirection: 'row', alignItems: 'center',
                                paddingHorizontal: 14, paddingVertical: 13,
                                borderBottomWidth: i < entries.length - 1 ? 1 : 0, borderColor: C.border,
                              }}>
                                <View style={{
                                  paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
                                  backgroundColor: isRev ? C.tealBg : C.roseBg,
                                  borderWidth: 1, borderColor: isRev ? C.tealBorder : C.roseBorder, marginRight: 12,
                                }}>
                                  <AppText style={{ color: isRev ? C.teal : C.rose, fontSize: 9, fontWeight: '800' }}>
                                    {isRev ? 'REV' : 'EXP'}
                                  </AppText>
                                </View>
                                <AppText style={{ flex: 1, color: C.text, fontSize: 14 }}>{e.quantity ? `${e.quantity}x ` : ''}{e.item_name || e.item || '—'}</AppText>
                                <AppText style={{ color: isRev ? C.teal : C.rose, fontSize: 15, fontWeight: '800', fontFamily: FONT_MONO }}>
                                  ₹{e.value || 0}
                                </AppText>
                              </View>
                            );
                          })}
                          {(totalRev > 0 || totalExp > 0) && (
                            <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 11, gap: 12, backgroundColor: C.surface }}>
                              {totalRev > 0 && <AppText style={{ color: C.teal, fontSize: 12, fontWeight: '700' }}>+₹{totalRev}</AppText>}
                              {totalExp > 0 && <AppText style={{ color: C.rose, fontSize: 12, fontWeight: '700' }}>−₹{totalExp}</AppText>}
                              <AppText style={{ color: C.textSub, fontSize: 12, fontWeight: '700', marginLeft: 'auto' }}>Net ₹{totalRev - totalExp}</AppText>
                            </View>
                          )}
                        </View>
                      ) : null}

                      {/* Udhari details */}
                      {isUdhari ? (
                        <View style={{
                          backgroundColor: C.indigoBg, borderRadius: 16,
                          borderWidth: 1, borderColor: C.indigoBorder, padding: 18, marginBottom: 14,
                        }}>
                          <AppText style={{ color: C.indigo, fontSize: 12, fontWeight: '700', marginBottom: 10, letterSpacing: 0.5 }}>CREDIT DETAILS</AppText>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <FontAwesome5 name="user" size={13} color={C.indigo} />
                            <AppText style={{ color: C.text, fontSize: 16, fontWeight: '800' }}>{uData.person_name || '—'}</AppText>
                          </View>
                          <AppText style={{ color: C.textSub, fontSize: 13, marginBottom: 8 }}>Item: {uData.item || 'Not specified'}</AppText>
                          <AppText style={{ color: C.indigo, fontSize: 22, fontWeight: '900', fontFamily: FONT_MONO }}>₹{uData.amount || 0}</AppText>
                        </View>
                      ) : null}

                      {/* Action buttons */}
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                        <Pressable
                          onPress={cancelPending}
                          style={{
                            flex: 1, paddingVertical: 16, borderRadius: 16,
                            backgroundColor: C.surfaceUp, alignItems: 'center',
                            borderWidth: 1, borderColor: C.border,
                          }}
                        >
                          <AppText style={{ color: C.textSub, fontWeight: '700', fontSize: 15 }}>Cancel</AppText>
                        </Pressable>
                        <Pressable
                          onPress={handleConfirm}
                          style={{
                            flex: 2, paddingVertical: 16, borderRadius: 16,
                            backgroundColor: ACCENT, alignItems: 'center',
                            shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
                          }}
                        >
                          <AppText style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Confirm & Save</AppText>
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
