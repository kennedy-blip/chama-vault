import React from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, MoonStar, Sun } from 'lucide-react';
import { type ThemeMode, updateVaultSettings } from '../db/vaultDb';
import { SPRING_PHYSICS } from '../db/formatters';

export interface ThemeDescriptor {
  id: ThemeMode;
  name: string;
  badge: string;
  description: string;
  metaColor: string;
  canvasPreview: string;
  cardPreview: string;
  accentPreview: string;
  borderPreview: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const THEME_OPTIONS: ThemeDescriptor[] = [
  {
    id: 'golden-vault',
    name: 'Golden Vault',
    badge: 'Default Dark',
    description: 'Deep obsidian (#0c0b0a) with warm amber, bronze gold rims, and smoked frosted glass.',
    metaColor: '#0c0b0a',
    canvasPreview: 'linear-gradient(135deg, #0c0b0a 0%, #1c150c 60%, #2a1c08 100%)',
    cardPreview: 'rgba(32, 26, 20, 0.85)',
    accentPreview: '#f59e0b',
    borderPreview: 'rgba(245, 158, 11, 0.5)',
    icon: Crown,
  },
  {
    id: 'emerald-trust',
    name: 'Emerald Trust',
    badge: 'Frosted Light',
    description: 'Clean frosted milk glass (bg-white/90), crisp slate borders, and emerald growth signals.',
    metaColor: '#eef4f1',
    canvasPreview: 'linear-gradient(135deg, #f5f9f7 0%, #e4f1ea 60%, #d1fae5 100%)',
    cardPreview: 'rgba(255, 255, 255, 0.94)',
    accentPreview: '#059669',
    borderPreview: 'rgba(5, 150, 105, 0.45)',
    icon: Sun,
  },
  {
    id: 'midnight-royal',
    name: 'Midnight Royal',
    badge: 'Sapphire Dark',
    description: 'Deep sovereign navy with brushed silver highlights and electric royal blue glow.',
    metaColor: '#060c1d',
    canvasPreview: 'linear-gradient(135deg, #060c1d 0%, #0d1d42 60%, #142b5e 100%)',
    cardPreview: 'rgba(15, 29, 62, 0.88)',
    accentPreview: '#38bdf8',
    borderPreview: 'rgba(56, 189, 248, 0.55)',
    icon: MoonStar,
  },
];

interface ThemeToggleProps {
  theme: ThemeMode;
  variant?: 'compact' | 'cards';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  theme,
  variant = 'cards',
}) => {
  const selectTheme = async (next: ThemeMode) => {
    if (next === theme) return;
    await updateVaultSettings({ theme: next });
  };

  if (variant === 'compact') {
    return (
      <div
        className="inline-flex items-center p-1 rounded-xl border backdrop-blur-xl"
        style={{
          background: 'var(--cv-surface-subtle)',
          borderColor: 'var(--cv-border)',
        }}
        role="radiogroup"
        aria-label="Color theme"
      >
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = opt.id === theme;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`Switch theme to ${opt.name}`}
              title={`${opt.name} (${opt.badge})`}
              onClick={() => selectTheme(opt.id)}
              className="relative p-1.5 rounded-lg transition-colors"
              style={{
                color: active ? 'var(--cv-accent-contrast)' : 'var(--cv-text-muted)',
              }}
            >
              {active && (
                <motion.span
                  layoutId="compact-theme-pill"
                  transition={SPRING_PHYSICS}
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'var(--cv-btn-grad)' }}
                />
              )}
              <Icon className="relative z-10 w-3.5 h-3.5" />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
      {THEME_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.id;
        return (
          <motion.button
            key={opt.id}
            type="button"
            whileTap={{ scale: 0.985 }}
            transition={SPRING_PHYSICS}
            onClick={() => selectTheme(opt.id)}
            className="relative text-left rounded-2xl p-4 border backdrop-blur-xl transition-all"
            style={{
              background: active ? 'var(--cv-accent-soft)' : 'var(--cv-surface-subtle)',
              borderColor: active ? 'var(--cv-border-strong)' : 'var(--cv-border-subtle)',
              boxShadow: active ? 'var(--cv-glow)' : 'none',
            }}
          >
            {/* Visual Theme Swatch Preview */}
            <div
              className="h-20 rounded-xl p-3 mb-3.5 border flex flex-col justify-between overflow-hidden"
              style={{
                background: opt.canvasPreview,
                borderColor: opt.borderPreview,
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="h-2.5 w-16 rounded-full"
                  style={{ background: opt.accentPreview }}
                />
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center border"
                  style={{
                    background: opt.cardPreview,
                    borderColor: opt.borderPreview,
                    color: opt.accentPreview,
                  }}
                >
                  <Icon className="w-3 h-3" />
                </div>
              </div>

              <div
                className="rounded-lg px-2.5 py-1.5 border flex items-center justify-between"
                style={{
                  background: opt.cardPreview,
                  borderColor: opt.borderPreview,
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: opt.accentPreview }}
                  />
                  <span
                    className="h-1.5 w-12 rounded-full opacity-60"
                    style={{
                      background: opt.id === 'emerald-trust' ? '#0f172a' : '#f8fafc',
                    }}
                  />
                </div>
                <span
                  className="h-1.5 w-8 rounded-full"
                  style={{ background: opt.accentPreview }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mb-1">
              <span
                className="text-sm font-bold"
                style={{ color: 'var(--cv-text)' }}
              >
                {opt.name}
              </span>
              {active ? (
                <span className="vault-badge-accent text-[11px] py-0.5 px-2">
                  <Check className="w-3 h-3" />
                  Active
                </span>
              ) : (
                <span
                  className="text-[11px] font-medium"
                  style={{ color: 'var(--cv-text-muted)' }}
                >
                  {opt.badge}
                </span>
              )}
            </div>
            <p
              className="text-xs leading-relaxed"
              style={{ color: 'var(--cv-text-muted)' }}
            >
              {opt.description}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
};
