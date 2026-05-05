
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Theme = 'fusion' | 'cyber' | 'executive' | 'heritage';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
  toggleLightMode: () => void;
}

// ─────────────────────────────────────────────
// Theme Metadata  (purely cosmetic)
// ─────────────────────────────────────────────
export const THEME_META: Record<
  Theme,
  {
    label: string;
    description: string;
    accent: string;
    surface: string;
    text: string;
    badge: string;
    icon: string;
  }
> = {
  fusion: {
    label: 'Fusion',
    description: 'Carbon — Minimalist Slate & Charcoal',
    accent: '#64748B',
    surface: '#0F172A',
    text: '#F1F5F9',
    badge: 'Dark',
    icon: '🌑',
  },
  cyber: {
    label: 'Matrix',
    description: 'Cyber — Neon Green & Pure Black',
    accent: '#2fff00ff',
    surface: '#050505',
    text: '#00ffa6ff',
    badge: 'Dark',
    icon: '📟',
  },
  executive: {
    label: 'Executive',
    description: 'Petroleum — Serious & Professional Corporate',
    accent: '#042166',
    surface: '#FFFFFF',
    text: '#0F172A',
    badge: 'Light',
    icon: '🏢',
  },
  heritage: {
    label: 'Obsidian',
    description: 'Industrial — Intense Orange & Steel Gray',
    accent: '#FF5500',
    surface: '#F5F5F5',
    text: '#19191C',
    badge: 'Light',
    icon: '🔥',
  },
};

export const THEME_ORDER: Theme[] = [
  'fusion',
  'cyber',
  'executive',
  'heritage',
];

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children?: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('executive');

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const cycleTheme = () => {
    setTheme((prev) => {
      const idx = THEME_ORDER.indexOf(prev);
      const nextIdx = (idx + 1) % THEME_ORDER.length;
      return THEME_ORDER[nextIdx];
    });
  };

  const toggleLightMode = () => {
    setTheme((prev) => {
      if (prev === 'executive' || prev === 'heritage') return 'fusion';
      return 'executive';
    });
  };
  // ────────────────────────────────────────────

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme, toggleLightMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

// ─────────────────────────────────────────────
// ThemeSwitcher UI Component
// Drop this anywhere — it reads from the context above.
// ─────────────────────────────────────────────
export const ThemeSwitcher = () => {
  const { theme, setTheme, cycleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const current = THEME_META[theme];

  return (
    <div style={styles.wrapper}>
      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          ...styles.trigger,
          background: current.accent,
          color: theme === 'executive' || theme === 'heritage' ? '#FFF' : '#FFF', // Keeping white text for dark/vibrant triggers
        }}
        title="Change theme"
      >
        <span style={styles.triggerIcon}>{current.icon}</span>
        <span style={styles.triggerLabel}>{current.label}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s ease',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          style={{
            ...styles.panel,
            background:
              theme === 'executive' || theme === 'heritage'
                ? '#FAFAFA'
                : '#111827',
            boxShadow:
              theme === 'executive' || theme === 'heritage'
                ? '0 24px 60px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)'
                : '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07)',
          }}
        >
          {/* Header */}
          <div
            style={{
              ...styles.panelHeader,
              borderBottom:
                theme === 'executive' || theme === 'heritage'
                  ? '1px solid rgba(0,0,0,0.05)'
                  : '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <span style={styles.panelTitle}>Select Theme</span>
            <button
              onClick={() => {
                cycleTheme();
                setOpen(false);
              }}
              style={{
                ...styles.cycleBtn,
                background:
                  theme === 'executive' || theme === 'heritage'
                    ? 'rgba(0,0,0,0.04)'
                    : 'rgba(255,255,255,0.07)',
                color:
                  theme === 'executive' || theme === 'heritage'
                    ? '#475569'
                    : '#94A3B8',
              }}
              title="Cycle to next theme"
            >
              ↻ Next
            </button>
          </div>

          {/* Theme options */}
          <div style={styles.optionList}>
            {THEME_ORDER.map((t) => {
              const meta = THEME_META[t];
              const isActive = t === theme;
              const isDark = theme === 'fusion' || theme === 'cyber';

              return (
                <button
                  key={t}
                  onClick={() => {
                    setTheme(t);
                    setOpen(false);
                  }}
                  style={{
                    ...styles.option,
                    ...(isActive ? styles.optionActive : {}),
                    background: isActive
                      ? isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.04)'
                      : 'transparent',
                  }}
                >
                  <span
                    style={{
                      ...styles.swatch,
                      background: `linear-gradient(135deg, ${meta.surface} 50%, ${meta.accent} 50%)`,
                      boxShadow: isActive
                        ? `0 0 0 2px ${meta.accent}`
                        : isDark
                          ? '0 0 0 1px rgba(255,255,255,0.12)'
                          : '0 0 0 1px rgba(0,0,0,0.08)',
                    }}
                  />

                  <span style={styles.optionText}>
                    <span
                      style={{
                        ...styles.optionName,
                        color: isDark ? '#F1F5F9' : '#1E293B',
                      }}
                    >
                      {meta.icon}&nbsp;{meta.label}
                    </span>
                    <span
                      style={{
                        ...styles.optionDesc,
                        color: isDark ? '#94A3B8' : '#64748B',
                      }}
                    >
                      {meta.description}
                    </span>
                  </span>

                  <span
                    style={{
                      ...styles.badge,
                      background:
                        meta.badge === 'Dark'
                          ? 'rgba(255,255,255,0.10)'
                          : 'rgba(0,0,0,0.08)',
                      color: meta.badge === 'Dark' ? '#CBD5E1' : '#475569',
                    }}
                  >
                    {meta.badge}
                  </span>

                  {isActive && (
                    <span style={{ ...styles.check, color: meta.accent }}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              ...styles.panelFooter,
              borderTop:
                theme === 'fusion' || theme === 'cyber'
                  ? '1px solid rgba(255,255,255,0.06)'
                  : '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <span
              style={{
                ...styles.footerText,
                color:
                  theme === 'fusion' || theme === 'cyber'
                    ? '#64748B'
                    : '#94A3B8',
              }}
            >
              Active:&nbsp;
              <strong style={{ color: current.accent }}>{current.label}</strong>
            </span>
          </div>
        </div>
      )}

      {/* ── Click-outside backdrop ── */}
      {open && (
        <div onClick={() => setOpen(false)} style={styles.backdrop} />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Styles  (plain objects — no extra deps)
// ─────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    display: 'inline-block',
    fontFamily: "'Inter', system-ui, sans-serif",
    zIndex: 9999,
  },
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 16px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '0.01em',
    boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
    transition: 'filter 0.2s ease, box-shadow 0.2s ease',
  },
  triggerIcon: { fontSize: 16 },
  triggerLabel: { minWidth: 72, textAlign: 'left' },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    right: 0,
    width: 290,
    background: '#111827',
    borderRadius: 14,
    boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07)',
    overflow: 'hidden',
    animation: 'fadeSlideDown 0.2s ease',
    zIndex: 9999,
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#64748B',
  },
  cycleBtn: {
    background: 'rgba(255,255,255,0.07)',
    border: 'none',
    borderRadius: 6,
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    cursor: 'pointer',
  },
  optionList: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 8px',
    gap: 4,
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 9,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.15s ease',
    width: '100%',
  },
  optionActive: {
    background: 'rgba(255,255,255,0.07)',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    flexShrink: 0,
  },
  optionText: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    gap: 2,
  },
  optionName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#E2E8F0',
  },
  optionDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 1.3,
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    padding: '2px 7px',
    borderRadius: 99,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  check: {
    fontSize: 15,
    fontWeight: 700,
    flexShrink: 0,
  },
  panelFooter: {
    padding: '10px 16px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    fontSize: 12,
    color: '#475569',
  },
  footerText: { display: 'block' },
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: -1,
  },
};