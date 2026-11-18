import React from 'react';
import { motion } from 'framer-motion';
import { Check, Eye, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { type Member, type UserRole, updateVaultSettings } from '../db/vaultDb';
import { SPRING_PHYSICS } from '../db/formatters';

interface RoleSwitcherProps {
  role: UserRole;
  members: Member[];
  viewingMemberId: number;
  variant?: 'compact' | 'header' | 'full';
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  role,
  members,
  viewingMemberId,
  variant = 'header',
}) => {
  const handleRoleChange = async (nextRole: UserRole) => {
    if (nextRole === role) return;
    const fallbackMemberId =
      viewingMemberId && members.some((m) => m.id === viewingMemberId)
        ? viewingMemberId
        : members[0]?.id ?? 0;
    await updateVaultSettings({
      activeRole: nextRole,
      viewingMemberId: fallbackMemberId,
    });
  };

  const handleMemberChange = async (memberId: number) => {
    await updateVaultSettings({ viewingMemberId: memberId });
  };

  if (variant === 'compact' || variant === 'header') {
    const options: Array<{
      id: UserRole;
      label: string;
      shortLabel: string;
      icon: React.ComponentType<{ className?: string }>;
    }> = [
      {
        id: 'treasurer',
        label: 'Treasurer / Admin',
        shortLabel: 'Treasurer',
        icon: ShieldCheck,
      },
      {
        id: 'member',
        label: 'Group Member',
        shortLabel: 'Member',
        icon: UserCheck,
      },
    ];

    return (
      <div className="inline-flex flex-wrap items-center gap-2">
        <div
          className="inline-flex items-center p-1 rounded-xl border backdrop-blur-xl"
          style={{
            background: 'var(--cv-surface-subtle)',
            borderColor: 'var(--cv-border)',
          }}
          role="radiogroup"
          aria-label="Active vault privilege role"
        >
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = role === opt.id;
            const layoutGroup =
              variant === 'compact' ? 'topbar-role-pill' : 'settings-header-role-pill';
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleRoleChange(opt.id)}
                className="relative inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  color: active ? 'var(--cv-accent-contrast)' : 'var(--cv-text-secondary)',
                }}
              >
                {active && (
                  <motion.span
                    layoutId={layoutGroup}
                    transition={SPRING_PHYSICS}
                    className="absolute inset-0 rounded-lg"
                    style={{ background: 'var(--cv-btn-grad)' }}
                  />
                )}
                <Icon className="relative z-10 w-3.5 h-3.5 shrink-0" />
                <span className="relative z-10 hidden sm:inline">
                  {variant === 'header' ? opt.label : opt.shortLabel}
                </span>
                <span className="relative z-10 sm:hidden">{opt.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {variant === 'header' && role === 'member' && members.length > 0 && (
          <select
            aria-label="Viewing as member"
            value={viewingMemberId || members[0]?.id}
            onChange={(e) => handleMemberChange(Number(e.target.value))}
            className="vault-input !w-auto !py-1.5 !px-2.5 !text-xs font-medium"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                Viewing as: {m.name} ({m.memberCode})
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  const treasurerPerms = [
    'Register members, edit profiles & update cycle targets',
    'Log & reverse periodic savings and project deposits',
    'Disburse merry-go-round payouts & reorder queue slots',
    'Export CSV reports, JSON backups & manage vault storage',
  ];

  const memberPerms = [
    'Inspect personal savings passbook & downloadable receipts',
    'Verify group vault totals, cycle collections & audit log',
    'Track merry-go-round rotation order & payout countdowns',
    'Read-only protection: cannot alter records or disburse funds',
  ];

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <button
          type="button"
          onClick={() => handleRoleChange('treasurer')}
          className="text-left rounded-2xl p-4 border transition-all"
          style={{
            background:
              role === 'treasurer' ? 'var(--cv-accent-soft)' : 'var(--cv-surface-subtle)',
            borderColor:
              role === 'treasurer' ? 'var(--cv-border-strong)' : 'var(--cv-border-subtle)',
            boxShadow: role === 'treasurer' ? 'var(--cv-glow)' : 'none',
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center border"
                style={{
                  background: 'var(--cv-accent-soft-strong)',
                  borderColor: 'var(--cv-border)',
                  color: 'var(--cv-accent)',
                }}
              >
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--cv-text)' }}>
                  Group Treasurer / Admin
                </p>
                <p className="text-[11px]" style={{ color: 'var(--cv-text-muted)' }}>
                  Full ledger write &amp; disbursement custody
                </p>
              </div>
            </div>
            {role === 'treasurer' && (
              <span className="vault-badge-accent">
                <Check className="w-3 h-3" /> Active
              </span>
            )}
          </div>
          <ul className="space-y-1.5 mt-3">
            {treasurerPerms.map((p) => (
              <li
                key={p}
                className="flex items-start gap-2 text-xs"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                <Check
                  className="w-3.5 h-3.5 mt-0.5 shrink-0"
                  style={{ color: 'var(--cv-positive)' }}
                />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </button>

        <button
          type="button"
          onClick={() => handleRoleChange('member')}
          className="text-left rounded-2xl p-4 border transition-all"
          style={{
            background:
              role === 'member' ? 'var(--cv-accent-soft)' : 'var(--cv-surface-subtle)',
            borderColor:
              role === 'member' ? 'var(--cv-border-strong)' : 'var(--cv-border-subtle)',
            boxShadow: role === 'member' ? 'var(--cv-glow)' : 'none',
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center border"
                style={{
                  background: 'var(--cv-info-soft)',
                  borderColor: 'var(--cv-info-border)',
                  color: 'var(--cv-info)',
                }}
              >
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--cv-text)' }}>
                  Group Member
                </p>
                <p className="text-[11px]" style={{ color: 'var(--cv-text-muted)' }}>
                  Verified read-only transparency mode
                </p>
              </div>
            </div>
            {role === 'member' && (
              <span className="vault-badge-accent">
                <Check className="w-3 h-3" /> Active
              </span>
            )}
          </div>
          <ul className="space-y-1.5 mt-3">
            {memberPerms.map((p, idx) => (
              <li
                key={p}
                className="flex items-start gap-2 text-xs"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                {idx === memberPerms.length - 1 ? (
                  <Lock
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    style={{ color: 'var(--cv-warning)' }}
                  />
                ) : (
                  <Check
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    style={{ color: 'var(--cv-info)' }}
                  />
                )}
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </button>
      </div>

      {role === 'member' && members.length > 0 && (
        <div className="glass-subtle p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--cv-text)' }}>
              Active Member Passbook Identity
            </p>
            <p className="text-[11px]" style={{ color: 'var(--cv-text-muted)' }}>
              Choose which member&apos;s personal ledger statement and payout countdown to inspect.
            </p>
          </div>
          <select
            aria-label="Select active member passbook"
            value={viewingMemberId || members[0]?.id}
            onChange={(e) => handleMemberChange(Number(e.target.value))}
            className="vault-input sm:!w-64 !py-2 !text-xs font-semibold"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.memberCode} · {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
