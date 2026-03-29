import React, { useState, useEffect, useContext } from 'react';
import AppText from '../core/AppText';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Modal, Platform, KeyboardAvoidingView } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import { AuthContext } from '../../_layout';
import { useTheme, ACCENT, FONT_MONO } from '../core/theme';
import { AppContext } from '../core/AppContext';
import { API_BASE } from '../utils/constants';
import { ScreenHeader, AuthInput } from '../shared';
import i18n from '../../../translations';

export default function ShopsScreen({ toggleSidebar }) {
  const { token } = useContext(AuthContext);
  const { C } = useTheme();
  const { activeStall, setActiveStall, setStalls } = useContext(AppContext);
  const [localStalls, setLocalStalls] = useState([]);
  const [loading, setLoading] = useState(true);
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
      if (res.data.length > 0 && !activeStall) setActiveStall(res.data[0]);
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
      setShowStallModal(false); fetchStalls();
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
      setShowMenuModal(false); fetchStalls();
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
      <ScreenHeader
        title={i18n.t('myShops', { defaultValue: 'My Shops' })}
        toggleSidebar={toggleSidebar}
        right={
          <Pressable
            onPress={() => { setStallForm({ id: null, name: '', location: '' }); setShowStallModal(true); }}
            hitSlop={10}
            style={{
              width: 34, height: 34, borderRadius: 10,
              backgroundColor: ACCENT + '20', borderWidth: 1, borderColor: ACCENT + '40',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <FontAwesome5 name="plus" size={13} color={ACCENT} />
          </Pressable>
        }
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {localStalls.map(stall => (
            <View key={stall.id} style={{
              backgroundColor: C.surface, borderRadius: 20,
              borderWidth: 1, borderColor: activeStall?.id === stall.id ? C.tealBorder : C.border,
              marginBottom: 20, overflow: 'hidden',
              shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
            }}>
              {/* Stall header */}
              <View style={{
                padding: 18, borderBottomWidth: 1, borderColor: C.border,
                backgroundColor: activeStall?.id === stall.id ? C.tealBg : C.surfaceUp,
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: stall.location ? 4 : 0 }}>
                    {activeStall?.id === stall.id && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal }} />
                    )}
                    <AppText style={{ color: C.text, fontSize: 18, fontWeight: '800' }}>{stall.name}</AppText>
                  </View>
                  {stall.location && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <FontAwesome5 name="map-marker-alt" size={11} color={C.textSub} />
                      <AppText style={{ color: C.textSub, fontSize: 13 }}>{stall.location}</AppText>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                  <Pressable
                    onPress={() => { setStallForm({ id: stall.id, name: stall.name, location: stall.location || '' }); setShowStallModal(true); }}
                    hitSlop={8}
                  >
                    <FontAwesome5 name="pen" size={15} color={C.textSub} />
                  </Pressable>
                  <Pressable onPress={() => deleteStall(stall.id)} hitSlop={8}>
                    <FontAwesome5 name="trash" size={15} color={C.rose} />
                  </Pressable>
                </View>
              </View>

              {/* Menu section */}
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <FontAwesome5 name="utensils" size={11} color={C.textSub} />
                    <AppText style={{ color: C.textSub, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>MENU ITEMS</AppText>
                  </View>
                  <Pressable
                    onPress={() => { setMenuForm({ stallId: stall.id, itemId: null, name: '', price: '' }); setShowMenuModal(true); }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      backgroundColor: C.tealBg, paddingHorizontal: 12, paddingVertical: 6,
                      borderRadius: 10, borderWidth: 1, borderColor: C.tealBorder,
                    }}
                  >
                    <FontAwesome5 name="plus" size={10} color={C.teal} />
                    <AppText style={{ color: C.teal, fontSize: 12, fontWeight: '700' }}>Add Item</AppText>
                  </Pressable>
                </View>

                {stall.menu_items?.length === 0 ? (
                  <AppText style={{ color: C.textFaint, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 }}>
                    No items yet
                  </AppText>
                ) : (
                  <View style={{ gap: 8 }}>
                    {stall.menu_items?.map(item => (
                      <View key={item.id} style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        backgroundColor: C.bg, padding: 14, borderRadius: 12,
                        borderWidth: 1, borderColor: C.border,
                      }}>
                        <View style={{ flex: 1 }}>
                          <AppText style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{item.item_name}</AppText>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <FontAwesome5 name="fire" size={10} color={C.amber} />
                            <AppText style={{ color: C.textSub, fontSize: 12, fontWeight: '600' }}>
                              Sold Today: <AppText style={{ color: C.amber, fontWeight: '800' }}>{Math.round(item.sold_today || 0)}</AppText>
                            </AppText>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                          <AppText style={{ color: C.text, fontSize: 16, fontWeight: '800', fontFamily: FONT_MONO }}>₹{item.price_per_unit}</AppText>
                          <Pressable
                            onPress={() => { setMenuForm({ stallId: stall.id, itemId: item.id, name: item.item_name, price: item.price_per_unit.toString() }); setShowMenuModal(true); }}
                            hitSlop={8}
                          >
                            <FontAwesome5 name="pen" size={13} color={C.textSub} />
                          </Pressable>
                          <Pressable onPress={() => deleteMenu(item.id)} hitSlop={8}>
                            <FontAwesome5 name="times" size={14} color={C.rose} />
                          </Pressable>
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' }}>
          <View style={{ backgroundColor: C.surface, borderRadius: 28, margin: 24, padding: 26, paddingBottom: 32 }}>
            <AppText style={{ color: C.text, fontSize: 20, fontWeight: '900', marginBottom: 22 }}>
              {stallForm.id ? 'Edit Shop' : 'Add Shop'}
            </AppText>
            <AuthInput label="Shop Name" value={stallForm.name} onChangeText={t => setStallForm({ ...stallForm, name: t })} placeholder="e.g. Raju Vadapav" />
            <AuthInput label="Location (Optional)" value={stallForm.location} onChangeText={t => setStallForm({ ...stallForm, location: t })} placeholder="e.g. Bandra East" />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
              <Pressable onPress={() => setShowStallModal(false)} style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: C.bgElevated, alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
                <AppText style={{ color: C.textSub, fontWeight: '700' }}>Cancel</AppText>
              </Pressable>
              <Pressable onPress={saveStall} style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: ACCENT, alignItems: 'center', shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 }}>
                <AppText style={{ color: '#fff', fontWeight: '800' }}>Save Shop</AppText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Menu Item Modal */}
      <Modal visible={showMenuModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' }}>
          <View style={{ backgroundColor: C.surface, borderRadius: 28, margin: 24, padding: 26, paddingBottom: 32 }}>
            <AppText style={{ color: C.text, fontSize: 20, fontWeight: '900', marginBottom: 22 }}>
              {menuForm.itemId ? 'Edit Item' : 'Add Item'}
            </AppText>
            <AuthInput label="Item Name" value={menuForm.name} onChangeText={t => setMenuForm({ ...menuForm, name: t })} placeholder="e.g. Samosa" />
            <AuthInput label="Price (₹)" value={menuForm.price} onChangeText={t => setMenuForm({ ...menuForm, price: t })} keyboardType="numeric" placeholder="e.g. 15" />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
              <Pressable onPress={() => setShowMenuModal(false)} style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: C.bgElevated, alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
                <AppText style={{ color: C.textSub, fontWeight: '700' }}>Cancel</AppText>
              </Pressable>
              <Pressable onPress={saveMenu} style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: C.teal, alignItems: 'center', shadowColor: C.teal, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 }}>
                <AppText style={{ color: '#fff', fontWeight: '800' }}>Save Item</AppText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
