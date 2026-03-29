import React, { useState, useEffect, useContext } from 'react';
import AppText from '../core/AppText';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import { AuthContext } from '../../_layout';
import { useTheme, ACCENT, FONT_MONO } from '../core/theme';
import { AppContext } from '../core/AppContext';
import { API_BASE } from '../utils/constants';
import { ScreenHeader } from '../shared';
import i18n from '../../../translations';

export default function UdhariScreen({ toggleSidebar }) {
  const { token } = useContext(AuthContext);
  const { C } = useTheme();
  const { activeStall, playAudio, playingUrl } = useContext(AppContext);
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
        text: 'Mark Paid', onPress: async () => {
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
      <ScreenHeader title={i18n.t('ledger', { defaultValue: 'Udhari (Borrow)' })} toggleSidebar={toggleSidebar} />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>

          {/* Total pending card */}
          <View style={{
            backgroundColor: C.roseBg, borderRadius: 20, padding: 22,
            borderWidth: 1, borderColor: C.roseBorder,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <View>
              <AppText style={{ color: C.rose, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 }}>
                {i18n.t('net_profit', { defaultValue: 'TOTAL PENDING' })}
              </AppText>
              <AppText style={{ color: C.rose, fontSize: 34, fontWeight: '900', fontFamily: FONT_MONO }}>₹{totalPending}</AppText>
            </View>
            <View style={{
              width: 52, height: 52, borderRadius: 16,
              backgroundColor: C.rose + '20', alignItems: 'center', justifyContent: 'center',
            }}>
              <FontAwesome5 name="hands-helping" size={22} color={C.rose} />
            </View>
          </View>

          {/* Section label */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <FontAwesome5 name="users" size={11} color={C.textSub} />
            <AppText style={{ color: C.textSub, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>PEOPLE</AppText>
          </View>

          {people.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <FontAwesome5 name="handshake" size={32} color={C.textFaint} style={{ marginBottom: 14 }} />
              <AppText style={{ color: C.textFaint, fontSize: 14 }}>No udhari records yet.</AppText>
              <AppText style={{ color: C.textFaint, fontSize: 13, marginTop: 4 }}>Add using voice in the Ask tab.</AppText>
            </View>
          ) : people.map(p => (
            <View key={p.id} style={{
              backgroundColor: C.surface, borderRadius: 18,
              borderWidth: 1, borderColor: p.pending_total > 0 ? C.roseBorder : C.border,
              overflow: 'hidden',
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
            }}>
              <Pressable
                onPress={() => setExpandedPerson(expandedPerson === p.id ? null : p.id)}
                style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{
                    width: 46, height: 46, borderRadius: 23,
                    backgroundColor: p.pending_total > 0 ? C.roseBg : C.tealBg,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: p.pending_total > 0 ? C.roseBorder : C.tealBorder,
                  }}>
                    <AppText style={{ color: p.pending_total > 0 ? C.rose : C.teal, fontWeight: '900', fontSize: 18 }}>
                      {p.name.charAt(0).toUpperCase()}
                    </AppText>
                  </View>
                  <View>
                    <AppText style={{ color: p.pending_total > 0 ? C.rose : C.text, fontSize: 16, fontWeight: '700' }}>
                      {p.name}
                    </AppText>
                    <AppText style={{ color: p.pending_total > 0 ? C.rose : C.teal, fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                      {p.pending_total > 0 ? `Owes ₹${p.pending_total}` : 'All settled'}
                    </AppText>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {p.pending_total > 0 && (
                    <Pressable
                      onPress={() => markAllPaid(p.id)}
                      style={{
                        backgroundColor: C.tealBg, paddingHorizontal: 12, paddingVertical: 6,
                        borderRadius: 10, borderWidth: 1, borderColor: C.tealBorder,
                      }}
                    >
                      <AppText style={{ color: C.teal, fontSize: 11, fontWeight: '700' }}>Clear All</AppText>
                    </Pressable>
                  )}
                  <FontAwesome5 name={expandedPerson === p.id ? 'chevron-up' : 'chevron-down'} size={10} color={C.textSub} />
                </View>
              </Pressable>

              {expandedPerson === p.id && (
                <View style={{ backgroundColor: C.surfaceUp, borderTopWidth: 1, borderColor: C.border }}>
                  {p.entries.length === 0
                    ? <AppText style={{ padding: 16, color: C.textFaint }}>No history.</AppText>
                    : p.entries.map(e => {
                      const isPending = e.status === 'pending';
                      return (
                        <View key={e.id} style={{ padding: 16, borderBottomWidth: 1, borderColor: C.border + '50' }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <View style={{
                                  flexDirection: 'row', alignItems: 'center', gap: 5,
                                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                                  backgroundColor: isPending ? C.roseBg : C.tealBg,
                                  borderWidth: 1, borderColor: isPending ? C.roseBorder : C.tealBorder,
                                }}>
                                  <FontAwesome5 name={isPending ? 'circle' : 'check'} size={8} color={isPending ? C.rose : C.teal} solid />
                                  <AppText style={{ color: isPending ? C.rose : C.teal, fontSize: 9, fontWeight: '800' }}>
                                    {isPending ? 'PENDING' : 'PAID'}
                                  </AppText>
                                </View>
                                <AppText style={{ color: C.textFaint, fontSize: 10 }}>
                                  {new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </AppText>
                              </View>
                              {e.item ? (
                                <>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                    <FontAwesome5 name="box" size={11} color={C.textSub} />
                                    <AppText style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{e.item}</AppText>
                                  </View>
                                  <AppText style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
                                    Total: <AppText style={{ color: isPending ? C.rose : C.teal, fontWeight: '700', fontFamily: FONT_MONO }}>₹{e.amount}</AppText>
                                  </AppText>
                                </>
                              ) : (
                                <AppText style={{ color: C.text, fontSize: 14 }}>
                                  Cash Udhari: <AppText style={{ color: isPending ? C.rose : C.teal, fontWeight: '700', fontFamily: FONT_MONO }}>₹{e.amount}</AppText>
                                </AppText>
                              )}
                              {e.audio_url && (
                                <Pressable
                                  onPress={() => playAudio(e.audio_url)}
                                  style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 7,
                                    marginTop: 10, paddingVertical: 6, paddingHorizontal: 12,
                                    backgroundColor: playingUrl === e.audio_url ? ACCENT + '20' : C.bgElevated,
                                    borderRadius: 8, alignSelf: 'flex-start',
                                    borderWidth: 1, borderColor: playingUrl === e.audio_url ? ACCENT + '40' : C.border,
                                  }}
                                >
                                  <FontAwesome5 name={playingUrl === e.audio_url ? 'pause' : 'play'} size={10} color={ACCENT} />
                                  <AppText style={{ color: ACCENT, fontSize: 11, fontWeight: '600' }}>
                                    {playingUrl === e.audio_url ? 'Playing…' : 'Play Voice'}
                                  </AppText>
                                </Pressable>
                              )}
                            </View>
                            {isPending && (
                              <Pressable
                                onPress={() => markPaid(e.id)}
                                disabled={payingId === e.id}
                                style={{
                                  backgroundColor: C.tealBg, paddingHorizontal: 14, paddingVertical: 9,
                                  borderRadius: 10, borderWidth: 1, borderColor: C.tealBorder, marginLeft: 12,
                                }}
                              >
                                {payingId === e.id
                                  ? <ActivityIndicator size="small" color={C.teal} />
                                  : <AppText style={{ color: C.teal, fontSize: 12, fontWeight: '700' }}>Mark Paid</AppText>
                                }
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
