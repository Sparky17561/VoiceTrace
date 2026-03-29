// ── Core (theme + context) ──
export { ThemeContext, ThemeProvider, useTheme, DARK, LIGHT, ACCENT, FONT_MONO } from './core/theme';
export { AppContext, AppProvider } from './core/AppContext';

// ── Shared Primitives ──
export { ThemeToggle, ConfPill, HamburgerBtn, ScreenHeader, AuthInput } from './shared';

// ── Screens ──
export { default as AuthScreen } from './auth/AuthScreen';
export { default as ChatBubble } from './chat/ChatBubble';
export { default as AskScreen } from './chat/AskScreen';
export { default as DashboardScreen } from './dashboard/DashboardScreen';
export { default as HistoryScreen } from './history/HistoryScreen';
export { default as UdhariScreen } from './udhari/UdhariScreen';
export { default as ShopsScreen } from './shops/ShopsScreen';
export { default as AppSidebar } from './navigation/AppSidebar';
export { default as OnboardingScreen } from './onboarding/OnboardingScreen';
