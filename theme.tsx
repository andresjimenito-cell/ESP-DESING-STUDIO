
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'industrial' | 'ocean' | 'forest' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
  toggleLightMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('industrial');

  useEffect(() => {
    // Update the data-theme attribute on the body
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const cycleTheme = () => {
    setTheme(prev => {
        if (prev === 'light') return 'industrial'; // Reset to dark flow
        if (prev === 'industrial') return 'ocean';
        if (prev === 'ocean') return 'forest';
        return 'industrial';
    });
  };

  const toggleLightMode = () => {
      setTheme(prev => prev === 'light' ? 'industrial' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme, toggleLightMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
