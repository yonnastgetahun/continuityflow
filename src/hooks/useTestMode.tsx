import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TestModeContextType {
  isTestMode: boolean;
  toggleTestMode: () => void;
  enableTestMode: () => void;
  disableTestMode: () => void;
}

const TestModeContext = createContext<TestModeContextType | undefined>(undefined);

const TEST_MODE_KEY = 'continuity:test_mode';

export function TestModeProvider({ children }: { children: ReactNode }) {
  const [isTestMode, setIsTestMode] = useState(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TEST_MODE_KEY) === 'true';
    }
    return false;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(TEST_MODE_KEY, isTestMode ? 'true' : 'false');
  }, [isTestMode]);

  const toggleTestMode = () => setIsTestMode(prev => !prev);
  const enableTestMode = () => setIsTestMode(true);
  const disableTestMode = () => setIsTestMode(false);

  return (
    <TestModeContext.Provider value={{
      isTestMode,
      toggleTestMode,
      enableTestMode,
      disableTestMode,
    }}>
      {children}
    </TestModeContext.Provider>
  );
}

export function useTestMode() {
  const context = useContext(TestModeContext);
  if (context === undefined) {
    throw new Error('useTestMode must be used within a TestModeProvider');
  }
  return context;
}
