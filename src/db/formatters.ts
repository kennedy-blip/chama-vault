import type {
  Contribution,
  ContributionCategory,
  CurrencyCode,
  FundraiserProject,
  Member,
  PaymentMethod,
  PayoutRecord,
  ProjectCategory,
  ProjectContribution,
  VaultSettings,
} from './vaultDb';

export const SPRING_PHYSICS = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 25,
};

export const CURRENCY_META: Record<
  CurrencyCode,
  { symbol: string; name: string; decimals: number }
> = {
  KES: { symbol: 'KES', name: 'Kenyan Shilling (KES)', decimals: 0 },
  USD: { symbol: '$', name: 'US Dollar (USD)', decimals: 2 },
  UGX: { symbol: 'UGX', name: 'Ugandan Shilling (UGX)', decimals: 0 },
  TZS: { symbol: 'TZS', name: 'Tanzanian Shilling (TZS)', decimals: 0 },
  NGN: { symbol: '₦', name: 'Nigerian Naira (NGN)', decimals: 0 },
  GBP: { symbol: '£', name: 'British Pound (GBP)', decimals: 2 },
  EUR: { symbol: '€', name: 'Euro (EUR)', decimals: 2 },
};

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = 'KES',
  compact = false
): string {
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.KES;
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);

  if (compact) {
    if (abs >= 1_000_000) {
      const val = (abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 2);
      return meta.symbol.length > 1
        ? `${sign}${meta.symbol} ${val}M`
        : `${sign}${meta.symbol}${val}M`;
    }
    if (abs >= 10_000) {
      const val = (abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1);
      return meta.symbol.length > 1
        ? `${sign}${meta.symbol} ${val}K`
        : `${sign}${meta.symbol}${val}K`;
    }
  }

  const hasFraction = Math.abs(abs - Math.round(abs)) > 0.001;
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: meta.decimals > 0 ? meta.decimals : hasFraction ? 2 : 0,
  });

  return meta.symbol.length > 1
    ? `${sign}${meta.symbol} ${formatted}`
    : `${sign}${meta.symbol}${formatted}`;
}

export const PAYMENT_METHOD_LABELS: Record<
  PaymentMethod,
  { label: string; short: string }
> = {
  mobile_transfer: { label: 'Mobile Transfer (M-Pesa)', short: 'Mobile Transfer' },
  cash: { label: 'Cash (Table Banking)', short: 'Cash' },
  bank_transfer: { label: 'Bank Transfer (EFT)', short: 'Bank EFT' },
  standing_order: { label: 'Standing Order', short: 'Standing Order' },
};

export const CONTRIBUTION_CATEGORY_LABELS: Record<ContributionCategory, string> = {
  regular: 'Regular Savings',
  arrears: 'Arrears Clearance',
  registration: 'Registration Fee',
  fine_settlement: 'Late Fine Settlement',
};

export const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  land: 'Land & Property',
  investment: 'Group Investment',
  event: 'Event & Retreat',
  welfare: 'Welfare Reserve',
  business: 'Business Venture',
};

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function addDaysToIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function getDaysUntil(isoDate: string): number {
  const [ty, tm, td] = todayIso().split('-').map(Number);
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const start = Date.UTC(ty, tm - 1, td);
  const end = Date.UTC(y, m - 1, d);
  return Math.round((end - start) / 86_400_000);
}

export function formatCountdownBadge(days: number): {
  label: string;
  tone: 'positive' | 'warning' | 'danger' | 'info' | 'accent';
} {
  if (days < 0) {
    const overdue = Math.abs(days);
    return {
      label: overdue === 1 ? '1 day overdue' : `${overdue}d overdue`,
      tone: 'danger',
    };
  }
  if (days === 0) return { label: 'Due today', tone: 'warning' };
  if (days === 1) return { label: 'Tomorrow', tone: 'warning' };
  if (days <= 7) return { label: `In ${days} days`, tone: 'warning' };
  if (days <= 30) return { label: `In ${days} days`, tone: 'accent' };
  return { label: `In ${days} days`, tone: 'info' };
}

export function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || !parts[0]) return isoDate;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatCycleMonth(ym: string): string {
  if (!ym || !ym.includes('-')) return ym;
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return dt.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function getRecentCycleMonths(anchorYm: string, count = 6): string[] {
  const [y, m] = anchorYm.split('-').map(Number);
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1 - i, 1));
    result.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
    );
  }
  return result;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function generateReceiptRef(prefix = 'SKV'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${suffix}`;
}

function escapeCsvCell(value: string | number | undefined | null): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function triggerFileDownload(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportFullFinancialReportCsv(data: {
  settings: VaultSettings;
  members: Member[];
  contributions: Contribution[];
  payouts: PayoutRecord[];
  projects: FundraiserProject[];
  projectContributions: ProjectContribution[];
}): void {
  const { settings, members, contributions, payouts, projects, projectContributions } =
    data;
  const memberMap = new Map(members.map((m) => [m.id!, m]));
  const projectMap = new Map(projects.map((p) => [p.id!, p]));
  const rows: string[][] = [];

  rows.push([`${settings.groupName} — ChamaVault Financial Ledger Report`]);
  rows.push([
    'Registration No',
    settings.registrationNo,
    'Currency',
    settings.currency,
    'Active Cycle',
    settings.currentCycleMonth,
    'Exported On',
    todayIso(),
  ]);
  rows.push([]);

  rows.push(['=== MEMBER SAVINGS & STANDING SUMMARY ===']);
  rows.push([
    'Member Code',
    'Full Name',
    'Phone',
    'Status',
    'Cycle Target',
    `Paid (${settings.currentCycleMonth})`,
    `Pending (${settings.currentCycleMonth})`,
    'Lifetime Ledger Savings',
    'Project Contributions',
    'Combined Member Equity',
  ]);

  members.forEach((m) => {
    const memberContribs = contributions.filter((c) => c.memberId === m.id);
    const totalSaved = memberContribs.reduce((s, c) => s + c.amount, 0);
    const cyclePaid = memberContribs
      .filter((c) => c.cycleMonth === settings.currentCycleMonth)
      .reduce((s, c) => s + c.amount, 0);
    const pending =
      m.status === 'active' ? Math.max(0, m.monthlyTarget - cyclePaid) : 0;
    const projTotal = projectContributions
      .filter((pc) => pc.memberId === m.id)
      .reduce((s, pc) => s + pc.amount, 0);

    rows.push([
      m.memberCode,
      m.name,
      m.phone,
      m.status,
      String(m.monthlyTarget),
      String(cyclePaid),
      String(pending),
      String(totalSaved),
      String(projTotal),
      String(totalSaved + projTotal),
    ]);
  });

  rows.push([]);
  rows.push(['=== PERIODIC CONTRIBUTION LEDGER ===']);
  rows.push([
    'Date',
    'Cycle',
    'Member Code',
    'Member Name',
    'Category',
    'Payment Method',
    'Reference',
    `Amount (${settings.currency})`,
    'Note',
  ]);

  [...contributions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((c) => {
      const m = memberMap.get(c.memberId);
      rows.push([
        c.date,
        c.cycleMonth,
        m?.memberCode ?? '',
        m?.name ?? 'Unknown',
        CONTRIBUTION_CATEGORY_LABELS[c.category],
        PAYMENT_METHOD_LABELS[c.paymentMethod].label,
        c.referenceCode,
        String(c.amount),
        c.note,
      ]);
    });

  rows.push([]);
  rows.push(['=== MERRY-GO-ROUND PAYOUT HISTORY ===']);
  rows.push([
    'Paid Date',
    'Round',
    'Cycle',
    'Beneficiary',
    'Payment Method',
    'Reference',
    `Amount (${settings.currency})`,
    'Notes',
  ]);

  [...payouts]
    .sort((a, b) => b.paidDate.localeCompare(a.paidDate))
    .forEach((p) => {
      const m = memberMap.get(p.memberId);
      rows.push([
        p.paidDate,
        `Round ${p.roundNumber}`,
        `Cycle #${p.cycleNumber}`,
        m?.name ?? 'Unknown',
        PAYMENT_METHOD_LABELS[p.paymentMethod].label,
        p.referenceCode,
        String(p.amount),
        p.notes,
      ]);
    });

  rows.push([]);
  rows.push(['=== PROJECT & EVENT FUNDRAISER CONTRIBUTIONS ===']);
  rows.push([
    'Date',
    'Project',
    'Contributor',
    'Payment Method',
    'Reference',
    `Amount (${settings.currency})`,
    'Note',
  ]);

  [...projectContributions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((pc) => {
      const p = projectMap.get(pc.projectId);
      const m = memberMap.get(pc.memberId);
      rows.push([
        pc.date,
        p?.title ?? 'Project',
        m?.name ?? 'Unknown',
        PAYMENT_METHOD_LABELS[pc.paymentMethod].label,
        pc.referenceCode,
        String(pc.amount),
        pc.note,
      ]);
    });

  const csv = rows.map((r) => r.map(escapeCsvCell).join(',')).join('\n');
  const slug = settings.groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  triggerFileDownload(
    csv,
    `${slug}-ledger-${todayIso()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

export function exportMemberStatementCsv(data: {
  settings: VaultSettings;
  member: Member;
  contributions: Contribution[];
  projectContributions: ProjectContribution[];
  projects: FundraiserProject[];
}): void {
  const { settings, member, contributions, projectContributions, projects } = data;
  const projectMap = new Map(projects.map((p) => [p.id!, p.title]));
  const memberContribs = contributions
    .filter((c) => c.memberId === member.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const memberProjContribs = projectContributions
    .filter((c) => c.memberId === member.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalSaved = memberContribs.reduce((s, c) => s + c.amount, 0);
  const totalProjects = memberProjContribs.reduce((s, c) => s + c.amount, 0);

  const rows: string[][] = [
    [`${settings.groupName} — Individual Member Savings Passbook`],
    ['Member', member.name, 'Code', member.memberCode, 'Phone', member.phone],
    [
      'Total Regular Savings',
      `${settings.currency} ${totalSaved}`,
      'Project Contributions',
      `${settings.currency} ${totalProjects}`,
      'Generated',
      todayIso(),
    ],
    [],
    ['Type', 'Date', 'Cycle / Project', 'Method', 'Reference', `Amount (${settings.currency})`, 'Note'],
  ];

  memberContribs.forEach((c) => {
    rows.push([
      CONTRIBUTION_CATEGORY_LABELS[c.category],
      c.date,
      c.cycleMonth,
      PAYMENT_METHOD_LABELS[c.paymentMethod].short,
      c.referenceCode,
      String(c.amount),
      c.note,
    ]);
  });

  memberProjContribs.forEach((pc) => {
    rows.push([
      'Project Fundraiser',
      pc.date,
      projectMap.get(pc.projectId) ?? 'Project',
      PAYMENT_METHOD_LABELS[pc.paymentMethod].short,
      pc.referenceCode,
      String(pc.amount),
      pc.note,
    ]);
  });

  const csv = rows.map((r) => r.map(escapeCsvCell).join(',')).join('\n');
  const slug = member.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  triggerFileDownload(
    csv,
    `${member.memberCode.toLowerCase()}-${slug}-statement.csv`,
    'text/csv;charset=utf-8;'
  );
}
