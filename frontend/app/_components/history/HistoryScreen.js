import React, { useState, useEffect, useContext } from 'react';
import AppText from '../core/AppText';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Alert, Linking } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import { AuthContext } from '../../_layout';
import { useTheme, ACCENT, FONT_MONO } from '../core/theme';
import { AppContext } from '../core/AppContext';
import { API_BASE, getToday } from '../utils/constants';
import { ScreenHeader } from '../shared';
import i18n from '../../../translations';

export default function HistoryScreen({ toggleSidebar }) {
  const { token } = useContext(AuthContext);
  const { C } = useTheme();
  const { activeStall, playAudio, playingUrl } = useContext(AppContext);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    if (!activeStall || !token) return;
    setLoading(true);
    const ep = search.trim()
      ? `/search?query=${encodeURIComponent(search)}&stall_id=${activeStall.id}`
      : `/entries?stall_id=${activeStall.id}`;
    axios.get(`${API_BASE}${ep}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setSessions(r.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [activeStall, token, search]);

  const processedSessions = sessions.map(s => {
    if (filterType === 'ALL') return s;
    const filteredEntries = (s.entries || []).filter(e => e.entry_type === filterType);
    return { ...s, entries: filteredEntries };
  }).filter(s => filterType === 'ALL' || (s.entries && s.entries.length > 0));

  const grouped = processedSessions.reduce((acc, s) => {
    const d = s.day_date || 'Unknown';
    if (!acc[d]) acc[d] = [];
    acc[d].push(s);
    return acc;
  }, {});
  
  const dates = Object.keys(grouped).sort((a, b) => sortAsc ? a.localeCompare(b) : b.localeCompare(a));

  const handleExport = async () => {
    if (!activeStall) return;
    try {
      Alert.alert('Generating PDF…', 'Please wait a moment.');
      await axios.get(`${API_BASE}/export/pdf?stall_id=${activeStall.id}&days=30`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob', timeout: 30000,
      });
      Linking.openURL(`${API_BASE}/export/pdf?stall_id=${activeStall.id}&days=30&token=${token}`);
    } catch {
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to delete all transaction history? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete All", 
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await axios.delete(`${API_BASE}/history?stall_id=${activeStall.id}`, { headers: { Authorization: `Bearer ${token}` } });
              setSessions([]);
              Alert.alert("Success", "History cleared.");
            } catch {
              Alert.alert("Error", "Failed to clear history.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader
        title={i18n.t('auditHistory', { defaultValue: 'History & Trust' })}
        toggleSidebar={toggleSidebar}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Pressable onPress={handleClearHistory} hitSlop={10} style={{ padding: 4 }}>
              <FontAwesome5 name="trash-alt" size={18} color={C.rose} />
            </Pressable>
            <Pressable onPress={handleExport} hitSlop={10} style={{ padding: 4 }}>
              <FontAwesome5 name="file-pdf" size={20} color={C.textSub} />
            </Pressable>
          </View>
        }
      />

      {/* Search bar */}
      <View style={{
        marginHorizontal: 16, marginTop: 14, marginBottom: 8,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: C.surface, borderRadius: 16,
        borderWidth: 1, borderColor: C.border,
        paddingHorizontal: 16, paddingVertical: 12,
      }}>
        <FontAwesome5 name="search" size={13} color={C.textSub} style={{ marginRight: 12 }} />
        <TextInput
          style={{ flex: 1, color: C.text, fontSize: 15, padding: 0 }}
          placeholder="Search entries…"
          placeholderTextColor={C.textFaint}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={10}>
            <FontAwesome5 name="times" size={14} color={C.textSub} />
          </Pressable>
        )}
      </View>

      {/* Filter and Sort Row */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 10 }}>
        {/* Sort Button */}
        <Pressable 
          onPress={() => setSortAsc(!sortAsc)}
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.border, gap: 8 }}
        >
          <FontAwesome5 name={sortAsc ? 'sort-amount-up' : 'sort-amount-down'} size={12} color={C.text} />
          <AppText style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>Date {sortAsc ? 'Oldest' : 'Newest'}</AppText>
        </Pressable>

        {/* Filter Scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {['ALL', 'REVENUE', 'EXPENSE'].map(type => (
            <Pressable
              key={type}
              onPress={() => setFilterType(type)}
              style={{
                backgroundColor: filterType === type ? ACCENT : C.surface,
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
                borderWidth: 1, borderColor: filterType === type ? ACCENT : C.border,
              }}
            >
              <AppText style={{ color: filterType === type ? '#fff' : C.text, fontSize: 13, fontWeight: '600' }}>
                {type === 'ALL' ? 'All' : type === 'REVENUE' ? 'Revenue' : 'Expense'}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {dates.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <FontAwesome5 name="history" size={32} color={C.textFaint} style={{ marginBottom: 14 }} />
              <AppText style={{ color: C.textFaint, fontSize: 14 }}>No records found.</AppText>
            </View>
          ) : dates.map(date => {
            const dayData = grouped[date];
            const dayRev = dayData.reduce((s, e) => s + (e.total_revenue || 0), 0);
            const dayExp = dayData.reduce((s, e) => s + (e.total_expense || 0), 0);
            return (
              <View key={date} style={{ marginBottom: 26 }}>
                {/* Date header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 2 }}>
                  <AppText style={{ color: C.textSub, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>
                    {date === getToday() ? 'TODAY' : date}
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <AppText style={{ color: C.teal, fontSize: 12, fontWeight: '700', fontFamily: FONT_MONO }}>+₹{Math.round(dayRev)}</AppText>
                    <AppText style={{ color: C.rose, fontSize: 12, fontWeight: '700', fontFamily: FONT_MONO }}>−₹{Math.round(dayExp)}</AppText>
                  </View>
                </View>

                {dayData.map(sess => (
                  <View key={sess.id} style={{
                    backgroundColor: C.surface, borderRadius: 18,
                    borderWidth: 1, borderColor: C.border, marginBottom: 12, overflow: 'hidden',
                    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
                  }}>
                    {/* Session header */}
                    <View style={{
                      padding: 14, backgroundColor: C.surfaceUp,
                      borderBottomWidth: 1, borderColor: C.border,
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{
                          flexDirection: 'row', alignItems: 'center', gap: 5,
                          backgroundColor: C.tealBg, paddingHorizontal: 8, paddingVertical: 4,
                          borderRadius: 6, borderWidth: 1, borderColor: C.tealBorder,
                        }}>
                          <FontAwesome5 name="lock" size={8} color={C.teal} />
                          <AppText style={{ color: C.teal, fontSize: 9, fontWeight: '800' }}>VERIFIED</AppText>
                        </View>
                        <FontAwesome5 name={sess.audio_url ? 'microphone' : 'keyboard'} size={11} color={C.textFaint} />
                        <AppText style={{ color: C.textFaint, fontSize: 11, fontFamily: FONT_MONO }}>#{sess.id.toString().padStart(6, '0')}</AppText>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {sess.audio_url && (
                          <Pressable
                            onPress={() => playAudio(sess.audio_url)}
                            style={{
                              width: 32, height: 32, borderRadius: 16,
                              backgroundColor: playingUrl === sess.audio_url ? ACCENT + '30' : C.bgElevated,
                              alignItems: 'center', justifyContent: 'center',
                              borderWidth: 1, borderColor: playingUrl === sess.audio_url ? ACCENT + '60' : C.border,
                            }}
                          >
                            <FontAwesome5 name={playingUrl === sess.audio_url ? 'pause' : 'play'} size={11} color={ACCENT} />
                          </Pressable>
                        )}
                        <AppText style={{ color: C.textSub, fontSize: 11 }}>
                          {new Date(sess.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </AppText>
                      </View>
                    </View>

                    {/* Entries */}
                    <View style={{ padding: 14 }}>
                      {(sess.entries || []).map((e, idx) => {
                        const isRev = e.entry_type === 'REVENUE';
                        return (
                          <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isRev ? C.teal : C.rose }} />
                              <AppText style={{ color: C.text, fontSize: 14 }}>{e.quantity ? `${e.quantity}x ` : ''}{e.item_name || 'Item'}</AppText>
                              {e.stockout_flag && <FontAwesome5 name="exclamation-circle" size={10} color={C.amber} />}
                            </View>
                            <AppText style={{ color: isRev ? C.teal : C.rose, fontSize: 14, fontWeight: '700', fontFamily: FONT_MONO }}>
                              ₹{e.value || 0}
                            </AppText>
                          </View>
                        );
                      })}
                      {sess.insight && (
                        <AppText style={{ color: C.textSub, fontSize: 12, fontStyle: 'italic', marginTop: 6 }}>"{sess.insight}"</AppText>
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
