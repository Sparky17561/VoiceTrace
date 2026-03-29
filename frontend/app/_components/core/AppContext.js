import React, { createContext } from 'react';

// ── APP CONTEXT ──
export const AppContext = createContext();

// ── APP PROVIDER ──
// Keep both context and provider co-located to prevent accidental mismatch
// and to make future AI/GhostMesh feature additions easier.
export function AppProvider({ children, value }) {
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
