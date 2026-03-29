import React, { useState, useRef, useEffect, useContext } from 'react';
import { View, Animated, Pressable, ActivityIndicator, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import axios from 'axios';
import { AuthContext } from './_layout';

// ── Core ──
import { ThemeProvider, useTheme, DARK, LIGHT } from './_components/core/theme';
import { AppProvider } from './_components/core/AppContext';

// ── Utils ──
import { API_BASE, SIDEBAR_W, getToday } from './_components/utils/constants';

// ── Screens ──
import AuthScreen from './_components/auth/AuthScreen';
import AskScreen from './_components/chat/AskScreen';
import DashboardScreen from './_components/dashboard/DashboardScreen';
import HistoryScreen from './_components/history/HistoryScreen';
import UdhariScreen from './_components/udhari/UdhariScreen';
import ShopsScreen from './_components/shops/ShopsScreen';
import AppSidebar from './_components/navigation/AppSidebar';
import OnboardingScreen from './_components/onboarding/OnboardingScreen';
import i18n from '../translations';

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

  // Localization Context
  const [appLocale, setAppLocale] = useState(i18n.locale);
  const changeLanguage = (lang) => { i18n.locale = lang; setAppLocale(lang); };

  const [fontSizeScale, setFontSizeScale] = useState(1.0);

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
    <AppProvider value={{
      stalls, setStalls, activeStall, setActiveStall,
      currentDay, setCurrentDay,
      playAudio, playingUrl,
      appLocale, changeLanguage,
      fontSizeScale, setFontSizeScale
    }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: resolved === 'dark' ? DARK.surface : LIGHT.surface }}>
        <StatusBar barStyle={resolved === 'dark' ? 'light-content' : 'dark-content'} />
        <View key={appLocale} style={{ flex: 1, flexDirection: 'row' }}>
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
    </AppProvider>
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