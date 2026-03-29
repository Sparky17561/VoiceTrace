import React, { useState, useEffect, useContext } from 'react';
import AppText from '../core/AppText';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import { AuthContext } from '../../_layout';
import { useTheme, ACCENT, FONT_MONO } from '../core/theme';
import { AppContext } from '../core/AppContext';
import { API_BASE } from '../utils/constants';
import { ScreenHeader } from '../shared';
import i18n from '../../../translations';

export default function DashboardScreen({ toggleSidebar }) {
  const { token } = useContext(AuthContext);
  const { C } = useTheme();
  const { currentDay, activeStall } = useContext(AppContext);
  const [summaries, setSummaries] = useState([]);
  const [insights, setInsights] = useState({ anomalies: [], demand_highlights: [], suggestions: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('today');
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

  const detectTrend = () => {
    if (summaries.length < 3) return { type: 'stable', text: 'Need more days of data to spot trends.' };
    const recent = summaries.slice(0, 3).reduce((s, d) => s + (d.total_revenue || 0), 0) / 3;
    const past = summaries.slice(3, 6).reduce((s, d) => s + (d.total_revenue || 0), 0) / 3;
    if (past === 0) return { type: 'rising', text: 'Sales are starting to grow this week.' };
    const pct = (recent - past) / past;
    if (pct > 0.1) return { type: 'rising', text: 'Your sales are growing — last 3 days were stronger than before.' };
    if (pct < -0.1) return { type: 'falling', text: 'Sales have dipped recently — check if any items are underperforming.' };
    return { type: 'stable', text: 'Sales are steady compared to a few days ago.' };
  };

  const trend = detectTrend();

  const getWeeklyPattern = () => {
    if (summaries.length < 5) return "Keep recording to unlock weekly patterns.";
    const valid = summaries.filter(s => s.total_revenue > 0);
    if (valid.length === 0) return "Not enough active days to find a pattern.";
    const bestDay = valid.sort((a, b) => b.total_revenue - a.total_revenue)[0];
    const dayName = new Date(bestDay.date).toLocaleDateString('en-US', { weekday: 'long' });
    return `Your best sales recently happen on ${dayName}s (₹${bestDay.total_revenue}).`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Dashboard" toggleSidebar={toggleSidebar} />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>

          {/* Tab Switcher */}
          <View style={{
            flexDirection: 'row', backgroundColor: C.surfaceUp,
            borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.border,
          }}>
            {['today', 'monthly'].map(t => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{
                  flex: 1, paddingVertical: 9, borderRadius: 10,
                  backgroundColor: tab === t ? C.surface : 'transparent',
                  alignItems: 'center',
                  shadowColor: tab === t ? '#000' : 'transparent',
                  shadowOpacity: 0.06, shadowRadius: 4, elevation: tab === t ? 2 : 0,
                }}
              >
                <AppText style={{ color: tab === t ? C.text : C.textSub, fontWeight: '700', fontSize: 13 }}>
                  {t === 'today' ? 'Today' : '30 Days'}
                </AppText>
              </Pressable>
            ))}
          </View>

          {/* Anomaly alerts */}
          {insights.anomalies?.length > 0 && (
            <View style={{ gap: 8 }}>
              {insights.anomalies.length > 2 ? (
                <View style={{ backgroundColor: C.roseBg, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.roseBorder, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <FontAwesome5 name="shield-alt" size={14} color={C.rose} style={{ marginTop: 1 }} />
                  <AppText style={{ flex: 1, color: C.rose, fontSize: 13, fontWeight: '600' }}>
                    {insights.anomalies.length} unusual activity patterns detected this month.
                  </AppText>
                </View>
              ) : (
                insights.anomalies.map((anno, idx) => (
                  <View key={idx} style={{ backgroundColor: C.roseBg, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.roseBorder, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <FontAwesome5 name="shield-alt" size={14} color={C.rose} style={{ marginTop: 1 }} />
                    <AppText style={{ flex: 1, color: C.rose, fontSize: 13, fontWeight: '600' }}>{anno}</AppText>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Stockout alert */}
          {activeData.stockout_items?.length > 0 && (
            <View style={{ backgroundColor: C.amberBg, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.amberBorder, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <FontAwesome5 name="exclamation-triangle" size={13} color={C.amber} style={{ marginTop: 1 }} />
              <AppText style={{ flex: 1, color: C.amber, fontSize: 13, fontWeight: '600' }}>
                You ran out of {activeData.stockout_items.join(', ')} {tab === 'today' ? 'today' : 'this month'}.
              </AppText>
            </View>
          )}

          {/* KPI Row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.border, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.tealBg, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="arrow-up" size={11} color={C.teal} />
                </View>
                <AppText style={{ color: C.textSub, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>{i18n.t('revenue', { defaultValue: 'REVENUE' })}</AppText>
              </View>
              <AppText style={{ color: C.teal, fontSize: 24, fontWeight: '900', fontFamily: FONT_MONO }}>
                ₹{Math.round(activeData.total_revenue || 0)}
              </AppText>
            </View>
            <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.border, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.roseBg, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="arrow-down" size={11} color={C.rose} />
                </View>
                <AppText style={{ color: C.textSub, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>{i18n.t('expense', { defaultValue: 'EXPENSE' })}</AppText>
              </View>
              <AppText style={{ color: C.rose, fontSize: 24, fontWeight: '900', fontFamily: FONT_MONO }}>
                ₹{Math.round(activeData.total_expense || 0)}
              </AppText>
            </View>
          </View>

          {/* Net Profit card */}
          <View style={{
            backgroundColor: net >= 0 ? C.tealBg : C.roseBg, borderRadius: 22, padding: 22,
            borderWidth: 1, borderColor: net >= 0 ? C.tealBorder : C.roseBorder,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <View>
              <AppText style={{ color: net >= 0 ? C.teal : C.rose, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                Net Profit
              </AppText>
              <AppText style={{ color: net >= 0 ? C.teal : C.rose, fontSize: 34, fontWeight: '900', fontFamily: FONT_MONO }}>
                {net >= 0 ? '+' : ''}₹{Math.round(net)}
              </AppText>
            </View>
            <View style={{
              width: 56, height: 56, borderRadius: 18,
              backgroundColor: net >= 0 ? C.teal + '20' : C.rose + '20',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <FontAwesome5
                name={net >= 0 ? 'chart-line' : 'chart-bar'}
                size={24}
                color={net >= 0 ? C.teal : C.rose}
              />
            </View>
          </View>

          {/* Govt Schemes */}
          <View style={{ backgroundColor: '#0F172A', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#1E293B' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <FontAwesome5 name="landmark" size={13} color="#818CF8" />
              <AppText style={{ color: '#818CF8', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{i18n.t('govtSchemes', { defaultValue: 'GOVT SCHEMES' })}</AppText>
            </View>
            {insights.recommended_scheme ? (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 16, borderLeftWidth: 3, borderColor: ACCENT }}>
                <AppText style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '800', marginBottom: 4 }}>{insights.recommended_scheme.name}</AppText>
                <AppText style={{ color: 'rgba(248,250,252,0.8)', fontSize: 13 }}>{insights.recommended_scheme.reason}</AppText>
              </View>
            ) : (
              <AppText style={{ color: 'rgba(248,250,252,0.6)', fontSize: 13 }}>Keep recording daily to unlock personalised scheme suggestions.</AppText>
            )}
          </View>

          {/* Loan Estimator */}
          <View style={{ backgroundColor: C.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <FontAwesome5 name="rocket" size={12} color={C.textSub} />
                <AppText style={{ color: C.textSub, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>LOAN ESTIMATOR</AppText>
              </View>
              <AppText style={{ color: C.text, fontSize: 26, fontWeight: '900' }}>₹{Math.round(monthlyData.profit * 3.5)}</AppText>
              <AppText style={{ color: C.teal, fontSize: 12, fontWeight: '600', marginTop: 2 }}>Estimated Credit Limit</AppText>
            </View>
            <FontAwesome5 name="university" size={28} color={C.textFaint} />
          </View>

          {/* Trend cards */}
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: C.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <FontAwesome5 name={trend.type === 'rising' ? 'trending-up' : trend.type === 'falling' ? 'trending-down' : 'minus'} size={12} color={trend.type === 'rising' ? C.teal : trend.type === 'falling' ? C.rose : C.textSub} />
                <AppText style={{ color: C.textSub, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>3-DAY TREND</AppText>
              </View>
              <AppText style={{ color: C.text, fontSize: 14, lineHeight: 22 }}>{trend.text}</AppText>
            </View>

            <View style={{ backgroundColor: C.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <FontAwesome5 name="calendar-alt" size={12} color={C.textSub} />
                <AppText style={{ color: C.textSub, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>7-DAY PATTERN</AppText>
              </View>
              <AppText style={{ color: C.text, fontSize: 14, lineHeight: 22 }}>{getWeeklyPattern()}</AppText>
            </View>

            {/* Demand highlights */}
            {insights.demand_highlights?.length > 0 && (
              <View style={{ backgroundColor: '#0F172A', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#1E293B' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <FontAwesome5 name="rocket" size={12} color="#38BDF8" />
                  <AppText style={{ color: '#38BDF8', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{i18n.t('demandInsights', { defaultValue: 'DEMAND INSIGHTS' })}</AppText>
                </View>
                {insights.demand_highlights.map((h, i) => (
                  <View key={i} style={{ marginBottom: 12 }}>
                    <AppText style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '700' }}>{h.item}</AppText>
                    <AppText style={{ color: 'rgba(248,250,252,0.85)', fontSize: 13, marginTop: 4 }}>
                      Sold ₹{Math.round(h.observed)} but early stockout detected. Estimated true demand: <AppText style={{ fontWeight: '900', color: '#38BDF8' }}>₹{Math.round(h.estimated)}</AppText>.
                    </AppText>
                    <AppText style={{ color: 'rgba(248,250,252,0.6)', fontSize: 11, fontStyle: 'italic', marginTop: 2 }}>{h.reason}</AppText>
                  </View>
                ))}
              </View>
            )}

            {/* Growth strategy */}
            <View style={{ backgroundColor: '#0F172A', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#1E293B' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <FontAwesome5 name="lightbulb" size={12} color="#818CF8" />
                <AppText style={{ color: '#818CF8', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>GROWTH STRATEGY (TOMORROW)</AppText>
              </View>
              {insights.suggestions?.map((sug, i) => (
                <View key={i} style={{ marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.06)', padding: 12, borderRadius: 12 }}>
                  <AppText style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700' }}>{sug.suggestion}</AppText>
                  <AppText style={{ color: 'rgba(248,250,252,0.7)', fontSize: 12, marginTop: 4 }}>Reason: {sug.reason}</AppText>
                </View>
              ))}
              {(!insights.suggestions || insights.suggestions.length === 0) && (
                <AppText style={{ color: 'rgba(248,250,252,0.7)', fontSize: 14 }}>Trend is stable. Keep stock levels similar to today.</AppText>
              )}
            </View>
          </View>

          {/* Daily breakdown */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <FontAwesome5 name="calendar-day" size={12} color={C.textSub} />
            <AppText style={{ color: C.textSub, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{i18n.t('dailyBreakdown', { defaultValue: 'DAILY BREAKDOWN' })}</AppText>
          </View>
          {summaries.map((s, i) => (
            <View key={i} style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
              <Pressable
                onPress={() => setExpandedDay(expandedDay === i ? null : i)}
                style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <AppText style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{s.date === currentDay ? i18n.t('today', { defaultValue: 'Today' }) : s.date}</AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <AppText style={{ color: s.profit >= 0 ? C.teal : C.rose, fontWeight: '700', fontFamily: FONT_MONO, fontSize: 14 }}>
                    {s.profit >= 0 ? '+' : ''}₹{Math.round(s.profit)}
                  </AppText>
                  <FontAwesome5 name={expandedDay === i ? 'chevron-up' : 'chevron-down'} size={10} color={C.textSub} />
                </View>
              </Pressable>
              {expandedDay === i && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4, backgroundColor: C.surfaceUp, borderTopWidth: 1, borderColor: C.border }}>
                  {Object.keys(s.items || {}).map(itemName => {
                    const it = s.items[itemName];
                    const isExp = (it.expense || 0) > 0 && (it.revenue || 0) === 0;
                    const val = isExp ? it.expense : it.revenue;
                    const sign = isExp ? '−' : '';
                    const color = isExp ? C.rose : C.teal;

                    return (
                      <View key={itemName} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <AppText style={{ color: C.textSub, fontSize: 13, minWidth: 20 }}>{it.quantity && it.quantity > 0 ? `${it.quantity}x` : ''}</AppText>
                          <AppText style={{ color: C.text, fontSize: 13 }}>{itemName}</AppText>
                          {it.stockout && <FontAwesome5 name="exclamation-circle" size={10} color={C.amber} />}
                        </View>
                        <AppText style={{ color: color, fontSize: 13, fontFamily: FONT_MONO }}>{sign}₹{Math.round(val || 0)}</AppText>
                      </View>
                    );
                  })}
                  {Object.keys(s.items || {}).length === 0 && (
                    <AppText style={{ color: C.textFaint, fontSize: 12, marginTop: 6 }}>No items recorded.</AppText>
                  )}
                </View>
              )}
            </View>
          ))}

        </ScrollView>
      )}
    </View>
  );
}
