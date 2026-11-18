import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Sparkles, X } from 'lucide-react';
import { SPRING_PHYSICS } from '../db/formatters';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export const ModalShell: React.FC<ModalShellProps> = ({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-lg',
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={SPRING_PHYSICS}
            className={`relative z-10 w-full ${maxWidthClass} glass-modal rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden`}
          >
            <div
              className="flex items-start justify-between gap-4 px-5 py-4 border-b shrink-0"
              style={{ borderColor: 'var(--cv-border-subtle)' }}
            >
              <div className="min-w-0">
                <h2
                  className="text-base sm:text-lg font-bold tracking-tight truncate"
                  style={{ color: 'var(--cv-text)' }}
                >
                  {title}
                </h2>
                {subtitle && (
                  <p
                    className="text-xs mt-0.5 leading-relaxed"
                    style={{ color: 'var(--cv-text-muted)' }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 rounded-lg border transition-colors shrink-0"
                style={{
                  borderColor: 'var(--cv-border-subtle)',
                  color: 'var(--cv-text-muted)',
                  background: 'var(--cv-surface-subtle)',
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface SuccessReceiptProps {
  title: string;
  amountFormatted: string;
  subtitle: string;
  details: Array<{ label: string; value: string; mono?: boolean }>;
  milestoneUnlocked?: string | null;
  onDone: () => void;
  onSecondary?: () => void;
  secondaryLabel?: string;
}

export const SuccessCheckmarkView: React.FC<SuccessReceiptProps> = ({
  title,
  amountFormatted,
  subtitle,
  details,
  milestoneUnlocked,
  onDone,
  onSecondary,
  secondaryLabel = 'Log Another',
}) => {
  return (
    <div className="py-3 text-center">
      <div className="relative mx-auto w-20 h-20 flex items-center justify-center mb-4">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1.25, opacity: 0.22 }}
          transition={SPRING_PHYSICS}
          className="absolute inset-0 rounded-full"
          style={{ background: 'var(--cv-positive)' }}
        />
        <motion.div
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={SPRING_PHYSICS}
          className="relative w-16 h-16 rounded-full flex items-center justify-center border-2"
          style={{
            background: 'var(--cv-positive-soft)',
            borderColor: 'var(--cv-positive)',
            color: 'var(--cv-positive)',
          }}
        >
          <motion.svg
            viewBox="0 0 28 28"
            fill="none"
            className="w-8 h-8"
          >
            <motion.path
              d="M6 14.5L11.5 20L22 8.5"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              initial={{ strokeDashoffset: 1, opacity: 0.4 }}
              animate={{ strokeDashoffset: 0, opacity: 1 }}
              transition={{ ...SPRING_PHYSICS, delay: 0.08 }}
            />
          </motion.svg>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_PHYSICS, delay: 0.1 }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wider mb-1"
          style={{ color: 'var(--cv-positive)' }}
        >
          {title}
        </p>
        <p
          className="text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight"
          style={{ color: 'var(--cv-text)' }}
        >
          {amountFormatted}
        </p>
        <p
          className="text-xs mt-1 mb-4"
          style={{ color: 'var(--cv-text-muted)' }}
        >
          {subtitle}
        </p>

        {milestoneUnlocked && (
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING_PHYSICS, delay: 0.18 }}
            className="mb-4 px-3.5 py-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold"
            style={{
              background: 'var(--cv-accent-soft)',
              borderColor: 'var(--cv-border-strong)',
              color: 'var(--cv-accent-strong)',
            }}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Milestone Unlocked: {milestoneUnlocked}</span>
          </motion.div>
        )}

        <div className="glass-subtle p-3.5 text-left space-y-2 mb-5">
          {details.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span style={{ color: 'var(--cv-text-muted)' }}>{item.label}</span>
              <span
                className={`font-semibold text-right truncate ${
                  item.mono ? 'font-mono tabular-nums' : ''
                }`}
                style={{ color: 'var(--cv-text)' }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          {onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="vault-btn-secondary flex-1"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onDone}
            className="vault-btn-primary flex-1"
          >
            <Check className="w-4 h-4" />
            <span>Done</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
