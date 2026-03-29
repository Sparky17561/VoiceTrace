import React, { useState, useEffect, useContext } from 'react';
import AppText from '../core/AppText';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
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
    if (summaries.length < 3) return { type: 'stable', text: i18n.t('needMoreData') };
    const recent = summaries.slice(0, 3).reduce((s, d) => s + (d.total_revenue || 0), 0) / 3;
    const past = summaries.slice(3, 6).reduce((s, d) => s + (d.total_revenue || 0), 0) / 3;
    if (past === 0) return { type: 'rising', text: i18n.t('startGrowthText') };
    const pct = (recent - past) / past;
    if (pct > 0.1) return { type: 'rising', text: i18n.t('risingText') };
    if (pct < -0.1) return { type: 'falling', text: i18n.t('fallingText') };
    return { type: 'stable', text: i18n.t('stableText') };
  };

  const trend = detectTrend();

  const getWeeklyPattern = () => {
    if (summaries.length < 5) return i18n.t('weeklyPatternSub');
    const valid = summaries.filter(s => s.total_revenue > 0);
    if (valid.length === 0) return i18n.t('noActiveDays');
    const bestDay = valid.sort((a, b) => b.total_revenue - a.total_revenue)[0];
    const dayName = new Date(bestDay.date).toLocaleDateString('en-US', { weekday: 'long' });
    return i18n.t('bestDayPattern', { day: dayName, amt: Math.round(bestDay.total_revenue) });
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
                  {t === 'today' ? i18n.t('today') : i18n.t('thirtyDays')}
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

          {/* KPI Row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.border, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.tealBg, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="arrow-up" size={11} color={C.teal} />
                </View>
                <AppText style={{ color: C.textSub, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>{i18n.t('revenue')}</AppText>
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
                <AppText style={{ color: C.textSub, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>{i18n.t('expense')}</AppText>
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
                {i18n.t('net_profit')}
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
              <AppText style={{ color: '#818CF8', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{i18n.t('govtSchemes')}</AppText>
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
                <AppText style={{ color: C.textSub, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{i18n.t('loanEstimator')}</AppText>
              </View>
              <AppText style={{ color: C.text, fontSize: 26, fontWeight: '900' }}>₹{Math.round(monthlyData.profit * 3.5)}</AppText>
              <AppText style={{ color: C.teal, fontSize: 12, fontWeight: '600', marginTop: 2 }}>{i18n.t('creditLimit')}</AppText>
            </View>
            <FontAwesome5 name="university" size={28} color={C.textFaint} />
          </View>

          {/* Stockout Alerts */}
          {tab === 'today' ? (
            activeData.stockout_items?.map((item, idx) => (
              <View key={idx} style={{ backgroundColor: C.roseBg, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: C.roseBorder, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.rose, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="clock" size={16} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={{ color: C.rose, fontSize: 15, fontWeight: '800' }}>{item} {i18n.t('isOutOfStock')}</AppText>
                  <AppText style={{ color: C.rose, fontSize: 12, opacity: 0.8 }}>{i18n.t('wentOutOfStockToday')}</AppText>
                </View>
              </View>
            ))
          ) : (
            summaries.filter(s => s.stockout_items?.length > 0).slice(0, 3).map((s, idx) => (
              s.stockout_items.map((item, j) => (
                <View key={`${idx}-${j}`} style={{ backgroundColor: C.roseBg, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: C.roseBorder, flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 10 }}>
                   <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.rose, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="calendar-day" size={16} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ color: C.rose, fontSize: 15, fontWeight: '800' }}>{item} {i18n.t(s.date === currentDay ? 'isOutOfStock' : 'wentOutOfStockToday')}</AppText>
                    <AppText style={{ color: C.rose, fontSize: 12, opacity: 0.8 }}>{i18n.t('recordedOn')} {s.date === currentDay ? i18n.t('today') : s.date}</AppText>
                  </View>
                </View>
              ))
            ))
          )}

          {/* Trend cards */}
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: C.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <FontAwesome5 name={trend.type === 'rising' ? 'chart-line' : trend.type === 'falling' ? 'chart-bar' : 'minus'} size={12} color={trend.type === 'rising' ? C.teal : trend.type === 'falling' ? C.rose : C.textSub} />
                <AppText style={{ color: C.textSub, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{i18n.t('threeDayTrend')}</AppText>
              </View>
              <AppText style={{ color: C.text, fontSize: 14, lineHeight: 22 }}>{trend.text}</AppText>
            </View>

            <View style={{ backgroundColor: C.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <FontAwesome5 name="calendar-alt" size={12} color={C.textSub} />
                <AppText style={{ color: C.textSub, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{i18n.t('sevenDayPattern')}</AppText>
              </View>
              <AppText style={{ color: C.text, fontSize: 14, lineHeight: 22 }}>{getWeeklyPattern()}</AppText>
            </View>

            {/* Day Expectations */}
            {insights.weekday_expectations?.items?.length > 0 && (
              <View style={{ backgroundColor: C.tealBg, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.tealBorder }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <FontAwesome5 name="magic" size={12} color={C.teal} />
                  <AppText style={{ color: C.teal, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{i18n.t('dayExpectation')}</AppText>
                </View>
                <AppText style={{ color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 10 }}>
                  {i18n.t('usuallyOnDay', { day: new Date().toLocaleDateString(i18n.locale, { weekday: 'long' }) })}
                </AppText>
                {insights.weekday_expectations.items.map((ex, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 10 }}>
                    <AppText style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>{i18n.t(ex.item)}</AppText>
                    <AppText style={{ color: C.teal, fontSize: 13, fontWeight: '700' }}>{i18n.t('expectedSales', { range: ex.range })}</AppText>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Demand highlights */}
          {insights.demand_highlights?.length > 0 && (
            <View style={{ backgroundColor: '#0F172A', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#1E293B' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <FontAwesome5 name="rocket" size={12} color="#38BDF8" />
                <AppText style={{ color: '#38BDF8', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{i18n.t('demandInsights')}</AppText>
              </View>
              {insights.demand_highlights.map((h, i) => (
                <View key={i} style={{ marginBottom: 12 }}>
                  <AppText style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '700' }}>{i18n.t(h.item)}</AppText>
                  <AppText style={{ color: 'rgba(248,250,252,0.85)', fontSize: 13, marginTop: 4 }}>
                    Sold ₹{Math.round(h.observed)} but early stockout detected. Estimated true demand: <AppText style={{ fontWeight: '900', color: '#38BDF8' }}>₹{Math.round(h.estimated)}</AppText>.
                  </AppText>
                  <AppText style={{ color: 'rgba(248,250,252,0.6)', fontSize: 11, fontStyle: 'italic', marginTop: 2 }}>{h.reason_key ? i18n.t(h.reason_key) : h.reason}</AppText>
                </View>
              ))}
            </View>
          )}

          {/* Growth strategy */}
          <View style={{ backgroundColor: '#0F172A', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#1E293B' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <FontAwesome5 name="lightbulb" size={12} color="#818CF8" />
              <AppText style={{ color: '#818CF8', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{i18n.t('growthStrategySub')}</AppText>
            </View>
            {insights.suggestions?.map((sug, i) => (
              <View key={i} style={{ marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.06)', padding: 12, borderRadius: 12 }}>
                <AppText style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700' }}>
                  {sug.suggestion_key ? i18n.t(sug.suggestion_key, { item: i18n.t(sug.item), pct: sug.percentage }) : sug.suggestion}
                </AppText>
                <AppText style={{ color: 'rgba(248,250,252,0.7)', fontSize: 12, marginTop: 4 }}>Reason: {sug.reason_key ? i18n.t(sug.reason_key) : sug.reason}</AppText>
              </View>
            ))}
            {(!insights.suggestions || insights.suggestions.length === 0) && (
              <AppText style={{ color: 'rgba(248,250,252,0.7)', fontSize: 14 }}>{i18n.t('stableStrategy')}</AppText>
            )}
          </View>

          {/* Daily breakdown */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <FontAwesome5 name="calendar-day" size={12} color={C.textSub} />
            <AppText style={{ color: C.textSub, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{i18n.t('dailyBreakdown')}</AppText>
          </View>
          {summaries.map((s, i) => (
            <View key={i} style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
              <Pressable
                onPress={() => setExpandedDay(expandedDay === i ? null : i)}
                style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <AppText style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{s.date === currentDay ? i18n.t('today') : s.date}</AppText>
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
