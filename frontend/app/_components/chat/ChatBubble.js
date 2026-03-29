import React, { useRef, useEffect, useContext } from 'react';
import AppText from '../core/AppText';
import { View, Text, Animated, Pressable, Dimensions } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme, ACCENT, FONT_MONO } from '../core/theme';
import { AppContext } from '../core/AppContext';
import { fmtAmt } from '../utils/format';

const { width: SCREEN_W } = Dimensions.get('window');

export default function ChatBubble({ msg }) {
  const { C } = useTheme();
  const { playAudio, playingUrl } = useContext(AppContext);
  const isBot = msg.role === 'assistant';
  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── User bubble ──
  if (!isBot) {
    return (
      <Animated.View style={{ alignItems: 'flex-end', marginBottom: 10, paddingHorizontal: 16, opacity: fade, transform: [{ translateY: slideY }] }}>
        <View style={{
          backgroundColor: ACCENT + '18',
          borderWidth: 1, borderColor: ACCENT + '35',
          paddingVertical: 12, paddingHorizontal: 16,
          borderRadius: 20, borderBottomRightRadius: 5,
          maxWidth: '80%',
        }}>
          <AppText style={{ color: C.text, fontSize: 15, lineHeight: 22 }}>{msg.content}</AppText>
        </View>
      </Animated.View>
    );
  }

  // ── Ledger Card ──
  if (msg.message_type === 'ledger_card' && msg.associated_session) {
    const r = msg.associated_session;
    const totalRev = r.entries?.filter(e => e.entry_type === 'REVENUE').reduce((s, e) => s + (e.value || 0), 0) || 0;
    const totalExp = r.entries?.filter(e => e.entry_type !== 'REVENUE').reduce((s, e) => s + (e.value || 0), 0) || 0;
    const hasLostSales = r.entries?.some(e => e.lost_sales_flag);

    return (
      <Animated.View style={{ alignItems: 'flex-start', marginBottom: 14, paddingHorizontal: 16, opacity: fade, transform: [{ translateY: slideY }] }}>
        <View style={{
          backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
          borderRadius: 20, borderBottomLeftRadius: 5,
          width: Math.min(SCREEN_W - 52, 360), overflow: 'hidden',
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
        }}>
          {/* Card Header */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            padding: 14, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.surfaceUp,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <View style={{
                width: 26, height: 26, borderRadius: 13,
                backgroundColor: C.tealBg, alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: C.tealBorder,
              }}>
                <FontAwesome5 name="check" size={11} color={C.teal} />
              </View>
              <AppText style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>Ledger Entry</AppText>
            </View>
            {r.audio_url && (
              <Pressable
                onPress={() => playAudio(r.audio_url)}
                style={{
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: playingUrl === r.audio_url ? ACCENT + '30' : C.bgElevated,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: playingUrl === r.audio_url ? ACCENT + '60' : C.border,
                }}
              >
                <FontAwesome5 name={playingUrl === r.audio_url ? 'pause' : 'play'} size={10} color={ACCENT} />
              </Pressable>
            )}
          </View>

          {/* Transcript */}
          {r.raw_text && (
            <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.border }}>
              <AppText style={{ color: C.textSub, fontSize: 12, fontStyle: 'italic', lineHeight: 18 }} numberOfLines={2}>
                "{r.raw_text}"
              </AppText>
            </View>
          )}

          {/* Entries */}
          {r.entries?.map((e, i) => {
            const isRev = e.entry_type === 'REVENUE';
            return (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingHorizontal: 14, paddingVertical: 11,
                borderBottomWidth: 1, borderColor: C.border + '60',
              }}>
                <View style={{
                  paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
                  backgroundColor: isRev ? C.tealBg : C.roseBg,
                  borderWidth: 1, borderColor: isRev ? C.tealBorder : C.roseBorder,
                  minWidth: 36, alignItems: 'center',
                }}>
                  <AppText style={{ color: isRev ? C.teal : C.rose, fontSize: 9, fontWeight: '800' }}>
                    {isRev ? 'REV' : 'EXP'}
                  </AppText>
                </View>
                <AppText style={{ flex: 1, color: C.text, fontSize: 14 }} numberOfLines={1}>{e.quantity ? `${e.quantity}x ` : ''}{e.item_name || '—'}</AppText>
                {e.stockout_flag && (
                  <View style={{ backgroundColor: C.rose, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginRight: 6 }}>
                    <AppText style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>{i18n.t('soldOutBadge')}</AppText>
                  </View>
                )}
                <AppText style={{ color: isRev ? C.teal : C.rose, fontSize: 14, fontWeight: '800', fontFamily: FONT_MONO }}>
                  {fmtAmt(e)}
                </AppText>
              </View>
            );
          })}

          {/* Totals */}
          {(totalRev > 0 || totalExp > 0) && (
            <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderColor: C.border }}>
              {totalRev > 0 && <AppText style={{ color: C.teal, fontSize: 12, fontWeight: '700', fontFamily: FONT_MONO }}>+₹{totalRev}</AppText>}
              {totalExp > 0 && <AppText style={{ color: C.rose, fontSize: 12, fontWeight: '700', fontFamily: FONT_MONO }}>−₹{totalExp}</AppText>}
              <AppText style={{ color: C.textSub, fontSize: 12, fontWeight: '700', fontFamily: FONT_MONO, marginLeft: 'auto' }}>
                Net ₹{totalRev - totalExp}
              </AppText>
            </View>
          )}

          {/* Lost sales warning */}
          {hasLostSales && (
            <View style={{ backgroundColor: C.amberBg, padding: 10, borderBottomWidth: 1, borderColor: C.amberBorder, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <FontAwesome5 name="exclamation-triangle" size={11} color={C.amber} />
              <AppText style={{ color: C.amber, fontSize: 11, lineHeight: 16, flex: 1 }}>
                Lost potential sales — item ran out with demand remaining
              </AppText>
            </View>
          )}
        </View>
      </Animated.View>
    );
  }

  // ── Action Card ──
  if (msg.message_type === 'action_card') {
    return (
      <Animated.View style={{ alignItems: 'flex-start', marginBottom: 14, paddingHorizontal: 16, opacity: fade, transform: [{ translateY: slideY }] }}>
        <View style={{
          backgroundColor: C.indigoBg, borderWidth: 1, borderColor: C.indigoBorder,
          paddingVertical: 13, paddingHorizontal: 16, borderRadius: 20, borderBottomLeftRadius: 5, maxWidth: '82%',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <FontAwesome5 name="check-circle" size={13} color={C.indigo} />
            <AppText style={{ color: C.indigo, fontSize: 12, fontWeight: '700' }}>Action Done</AppText>
          </View>
          <AppText style={{ color: C.text, fontSize: 14, lineHeight: 21 }}>{msg.content}</AppText>
        </View>
      </Animated.View>
    );
  }

  // ── Follow-up Bubble ──
  if (msg.message_type === 'follow_up') {
    return (
      <Animated.View style={{ alignItems: 'flex-start', marginBottom: 14, paddingHorizontal: 16, opacity: fade, transform: [{ translateY: slideY }] }}>
        <View style={{
          backgroundColor: C.surface, borderWidth: 1.5, borderColor: ACCENT + '50',
          paddingVertical: 13, paddingHorizontal: 16, borderRadius: 20, borderBottomLeftRadius: 5, maxWidth: '82%',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <FontAwesome5 name="comment-dots" size={12} color={ACCENT} />
            <AppText style={{ color: ACCENT, fontSize: 11, fontWeight: '700' }}>Follow-up</AppText>
          </View>
          <AppText style={{ color: C.text, fontSize: 14, lineHeight: 21 }}>{msg.content}</AppText>
        </View>
      </Animated.View>
    );
  }

  // ── Default text bubble ──
  return (
    <Animated.View style={{ alignItems: 'flex-start', marginBottom: 10, paddingHorizontal: 16, opacity: fade, transform: [{ translateY: slideY }] }}>
      <View style={{
        backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
        paddingVertical: 13, paddingHorizontal: 16, borderRadius: 20, borderBottomLeftRadius: 5, maxWidth: '82%',
      }}>
        <AppText style={{ color: C.textSub, fontSize: 15, lineHeight: 23 }}>{msg.content}</AppText>
      </View>
    </Animated.View>
  );
}
