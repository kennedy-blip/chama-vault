import Dexie, { type Table } from 'dexie';

export type ThemeMode = 'golden-vault' | 'emerald-trust' | 'midnight-royal';
export type UserRole = 'treasurer' | 'member';
export type PaymentMethod = 'mobile_transfer' | 'cash' | 'bank_transfer' | 'standing_order';
export type ContributionCategory = 'regular' | 'arrears' | 'registration' | 'fine_settlement';
export type ContributionFrequency = 'monthly' | 'biweekly' | 'weekly';
export type CurrencyCode = 'KES' | 'USD' | 'UGX' | 'TZS' | 'NGN' | 'GBP' | 'EUR';
export type ProjectCategory = 'land' | 'investment' | 'event' | 'welfare' | 'business';
export type ProjectStatus = 'active' | 'completed' | 'paused';

export interface Member {
  id?: number;
  memberCode: string;
  name: string;
  phone: string;
  email: string;
  title: string;
  avatarHue: string;
  joinedDate: string;
  monthlyTarget: number;
  rotationOrder: number;
  status: 'active' | 'paused';
  notes: string;
}

export interface Contribution {
  id?: number;
  memberId: number;
  amount: number;
  date: string;
  cycleMonth: string; // YYYY-MM
  paymentMethod: PaymentMethod;
  referenceCode: string;
  category: ContributionCategory;
  note: string;
  recordedBy: string;
  createdAt: string;
}

export interface PayoutRecord {
  id?: number;
  roundNumber: number;
  cycleNumber: number;
  memberId: number;
  amount: number;
  scheduledDate: string;
  paidDate: string;
  status: 'completed' | 'skipped';
  paymentMethod: PaymentMethod;
  referenceCode: string;
  notes: string;
  createdAt: string;
}

export interface ProjectMilestone {
  id: string;
  label: string;
  targetAmount: number;
  reachedAt?: string;
}

export interface FundraiserProject {
  id?: number;
  title: string;
  description: string;
  category: ProjectCategory;
  targetAmount: number;
  deadline: string;
  status: ProjectStatus;
  milestones: ProjectMilestone[];
  createdAt: string;
}

export interface ProjectContribution {
  id?: number;
  projectId: number;
  memberId: number;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  referenceCode: string;
  note: string;
  createdAt: string;
}

export interface VaultSettings {
  id: string; // always 'primary'
  groupName: string;
  registrationNo: string;
  location: string;
  currency: CurrencyCode;
  defaultTarget: number;
  frequency: ContributionFrequency;
  currentCycleMonth: string; // YYYY-MM
  rotationIntervalDays: number;
  nextPayoutDate: string; // YYYY-MM-DD
  currentRound: number;
  currentTurnOrder: number; // matches active member position index (0-based in sorted active rotation)
  payoutPotOverride: number | null;
  theme: ThemeMode;
  activeRole: UserRole;
  viewingMemberId: number;
  mobileFramePreview: boolean;
  initializedAt: string;
}

export interface AuditEntry {
  id?: number;
  timestamp: string;
  actor: string;
  category: 'deposit' | 'payout' | 'member' | 'project' | 'settings';
  summary: string;
  amount?: number;
}

export interface VaultBackupPayload {
  schemaVersion: number;
  app: 'ChamaVault';
  exportedAt: string;
  settings: VaultSettings;
  members: Member[];
  contributions: Contribution[];
  payouts: PayoutRecord[];
  projects: FundraiserProject[];
  projectContributions: ProjectContribution[];
  auditLog: AuditEntry[];
}

export class ChamaVaultDB extends Dexie {
  members!: Table<Member, number>;
  contributions!: Table<Contribution, number>;
  payouts!: Table<PayoutRecord, number>;
  projects!: Table<FundraiserProject, number>;
  projectContributions!: Table<ProjectContribution, number>;
  settings!: Table<VaultSettings, string>;
  auditLog!: Table<AuditEntry, number>;

  constructor() {
    super('ChamaVaultOfflineDB');
    this.version(1).stores({
      members: '++id, memberCode, name, rotationOrder, status',
      contributions: '++id, memberId, date, cycleMonth, paymentMethod, category, createdAt',
      payouts: '++id, roundNumber, cycleNumber, memberId, paidDate, status',
      projects: '++id, category, status, deadline, createdAt',
      projectContributions: '++id, projectId, memberId, date, paymentMethod, createdAt',
      settings: 'id',
      auditLog: '++id, timestamp, category',
    });
  }
}

export const db = new ChamaVaultDB();

const SEED_FLAG_KEY = 'chamavault_seeded_v1';

function shiftDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function getCurrentIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

function buildSeedDataset() {
  const today = getCurrentIsoDate();
  const currentMonth = today.slice(0, 7);
  const m1 = shiftMonths(currentMonth, -1);
  const m2 = shiftMonths(currentMonth, -2);
  const m3 = shiftMonths(currentMonth, -3);
  const m4 = shiftMonths(currentMonth, -4);
  const m5 = shiftMonths(currentMonth, -5);

  const members: Member[] = [
    {
      id: 1,
      memberCode: 'CV-001',
      name: 'Wanjiku Mwenda',
      phone: '+254 712 348 910',
      email: 'wanjiku.mwenda@chamavault.org',
      title: 'Group Treasurer',
      avatarHue: 'from-amber-500 to-orange-600',
      joinedDate: `${m5}-02`,
      monthlyTarget: 10000,
      rotationOrder: 1,
      status: 'active',
      notes: 'Founding treasurer and signatory. M-Pesa Till custodian.',
    },
    {
      id: 2,
      memberCode: 'CV-002',
      name: 'Kennedy Mutethia',
      phone: '+254 722 891 405',
      email: 'kennedy.m@chamavault.org',
      title: 'Chairperson',
      avatarHue: 'from-emerald-500 to-teal-600',
      joinedDate: `${m5}-02`,
      monthlyTarget: 10000,
      rotationOrder: 2,
      status: 'active',
      notes: 'Co-signatory and land investment committee lead.',
    },
    {
      id: 3,
      memberCode: 'CV-003',
      name: 'Amina Hassan',
      phone: '+254 733 519 220',
      email: 'amina.hassan@chamavault.org',
      title: 'Secretary',
      avatarHue: 'from-sky-500 to-blue-600',
      joinedDate: `${m5}-03`,
      monthlyTarget: 10000,
      rotationOrder: 3,
      status: 'active',
      notes: 'Maintains meeting minutes & attendance register.',
    },
    {
      id: 4,
      memberCode: 'CV-004',
      name: 'Brian Ochieng',
      phone: '+254 701 664 318',
      email: 'brian.ochieng@chamavault.org',
      title: 'Next Beneficiary',
      avatarHue: 'from-violet-500 to-indigo-600',
      joinedDate: `${m5}-04`,
      monthlyTarget: 10000,
      rotationOrder: 4,
      status: 'active',
      notes: 'Scheduled recipient for Cycle #4 merry-go-round pot.',
    },
    {
      id: 5,
      memberCode: 'CV-005',
      name: 'Faith Karimi',
      phone: '+254 728 407 192',
      email: 'faith.karimi@chamavault.org',
      title: 'Project Coordinator',
      avatarHue: 'from-rose-500 to-pink-600',
      joinedDate: `${m5}-05`,
      monthlyTarget: 10000,
      rotationOrder: 5,
      status: 'active',
      notes: 'Coordinates annual dividend gala and welfare disbursements.',
    },
    {
      id: 6,
      memberCode: 'CV-006',
      name: 'David Kipchoge',
      phone: '+254 719 772 840',
      email: 'david.kipchoge@chamavault.org',
      title: 'Member',
      avatarHue: 'from-cyan-500 to-sky-600',
      joinedDate: `${m5}-05`,
      monthlyTarget: 10000,
      rotationOrder: 6,
      status: 'active',
      notes: 'Pays via automated bank standing order on the 5th.',
    },
    {
      id: 7,
      memberCode: 'CV-007',
      name: 'Grace Njeri',
      phone: '+254 740 218 655',
      email: 'grace.njeri@chamavault.org',
      title: 'Welfare Rep',
      avatarHue: 'from-amber-400 to-yellow-600',
      joinedDate: `${m4}-01`,
      monthlyTarget: 10000,
      rotationOrder: 7,
      status: 'active',
      notes: 'Cleared partial deposit this cycle; balance promised by Friday.',
    },
    {
      id: 8,
      memberCode: 'CV-008',
      name: 'Samuel Murithi',
      phone: '+254 708 935 114',
      email: 'samuel.murithi@chamavault.org',
      title: 'Member',
      avatarHue: 'from-teal-500 to-emerald-600',
      joinedDate: `${m4}-03`,
      monthlyTarget: 10000,
      rotationOrder: 8,
      status: 'active',
      notes: 'Agribusiness supplier; typically settles contributions mid-month.',
    },
  ];

  const contributions: Contribution[] = [];
  const methods: PaymentMethod[] = ['mobile_transfer', 'mobile_transfer', 'bank_transfer', 'cash', 'standing_order'];
  const pastMonths = [m5, m4, m3, m2, m1];
  const refPrefixes = ['SJK', 'SLM', 'SNQ', 'SPR', 'STV'];

  // Historical full savings contributions
  pastMonths.forEach((month, mIdx) => {
    members.forEach((member) => {
      // Members 7 & 8 joined in m4
      if (mIdx === 0 && (member.id === 7 || member.id === 8)) return;
      const day = String(4 + ((member.id! * 2 + mIdx) % 10)).padStart(2, '0');
      const method =
        member.id === 6
          ? 'standing_order'
          : methods[(member.id! + mIdx) % methods.length];
      contributions.push({
        memberId: member.id!,
        amount: 10000,
        date: `${month}-${day}`,
        cycleMonth: month,
        paymentMethod: method,
        referenceCode:
          method === 'cash'
            ? `CSH-${month.replace('-', '')}-0${member.id}`
            : `${refPrefixes[mIdx]}${member.id}8M${24 + mIdx * 7}KQ`,
        category: 'regular',
        note: `Monthly regular savings — ${month}`,
        recordedBy: 'Wanjiku Mwenda',
        createdAt: `${month}-${day}T09:30:00.000Z`,
      });
    });
  });

  // Current month contributions (realistic mix: 5 fully paid, 2 partial, 1 pending)
  const currentEntries: Array<{
    memberId: number;
    amount: number;
    dayOffset: number;
    method: PaymentMethod;
    ref: string;
    note: string;
  }> = [
    {
      memberId: 1,
      amount: 10000,
      dayOffset: -14,
      method: 'mobile_transfer',
      ref: 'SKB94T12MP',
      note: 'M-Pesa Paybill deposit — full cycle cleared',
    },
    {
      memberId: 2,
      amount: 12000,
      dayOffset: -13,
      method: 'bank_transfer',
      ref: 'EFT-9048211',
      note: 'Monthly target + KES 2,000 advance buffer',
    },
    {
      memberId: 3,
      amount: 10000,
      dayOffset: -11,
      method: 'mobile_transfer',
      ref: 'SKD41W88ZA',
      note: 'M-Pesa transfer verified at monthly meeting',
    },
    {
      memberId: 4,
      amount: 10000,
      dayOffset: -9,
      method: 'mobile_transfer',
      ref: 'SKF72N09QL',
      note: 'Cleared ahead of Cycle #4 payout turn',
    },
    {
      memberId: 5,
      amount: 6000,
      dayOffset: -7,
      method: 'cash',
      ref: `CSH-${currentMonth.replace('-', '')}-05`,
      note: 'Table banking cash instalment 1 of 2',
    },
    {
      memberId: 6,
      amount: 10000,
      dayOffset: -12,
      method: 'standing_order',
      ref: 'STO-6620194',
      note: 'Automated 5th-of-month standing order',
    },
    {
      memberId: 7,
      amount: 5500,
      dayOffset: -4,
      method: 'mobile_transfer',
      ref: 'SKL18P53VR',
      note: 'First M-Pesa tranche; KES 4,500 pending',
    },
  ];

  currentEntries.forEach((entry) => {
    const entryDate = shiftDays(today, entry.dayOffset);
    contributions.push({
      memberId: entry.memberId,
      amount: entry.amount,
      date: entryDate,
      cycleMonth: currentMonth,
      paymentMethod: entry.method,
      referenceCode: entry.ref,
      category: 'regular',
      note: entry.note,
      recordedBy: 'Wanjiku Mwenda',
      createdAt: `${entryDate}T11:15:00.000Z`,
    });
  });

  // Past Merry-Go-Round payouts (Cycles 1, 2, 3 completed; Member #4 Brian is Up Next in 12 days)
  const payouts: PayoutRecord[] = [
    {
      roundNumber: 1,
      cycleNumber: 1,
      memberId: 1,
      amount: 80000,
      scheduledDate: shiftDays(today, -78),
      paidDate: shiftDays(today, -78),
      status: 'completed',
      paymentMethod: 'mobile_transfer',
      referenceCode: 'MGR-R1C1-771A',
      notes: 'Round 1 opening pot disbursed in full during monthly sitting.',
      createdAt: `${shiftDays(today, -78)}T15:00:00.000Z`,
    },
    {
      roundNumber: 1,
      cycleNumber: 2,
      memberId: 2,
      amount: 80000,
      scheduledDate: shiftDays(today, -48),
      paidDate: shiftDays(today, -48),
      status: 'completed',
      paymentMethod: 'bank_transfer',
      referenceCode: 'MGR-R1C2-884B',
      notes: 'Disbursed to Co-op Bank account; signed by 3 officials.',
      createdAt: `${shiftDays(today, -48)}T15:20:00.000Z`,
    },
    {
      roundNumber: 1,
      cycleNumber: 3,
      memberId: 3,
      amount: 80000,
      scheduledDate: shiftDays(today, -18),
      paidDate: shiftDays(today, -18),
      status: 'completed',
      paymentMethod: 'mobile_transfer',
      referenceCode: 'MGR-R1C3-932C',
      notes: 'Previous payout sent via M-Pesa bulk disbursement. Confirmed.',
      createdAt: `${shiftDays(today, -18)}T16:05:00.000Z`,
    },
  ];

  // Projects & Event Fundraisers
  const projects: FundraiserProject[] = [
    {
      id: 1,
      title: 'Nchiru 1-Acre Commercial Plot Acquisition',
      description:
        'Collective land investment along Meru-Maua Highway for future rental units and long-term capital appreciation for all 8 members.',
      category: 'land',
      targetAmount: 400000,
      deadline: shiftDays(today, 95),
      status: 'active',
      milestones: [
        {
          id: 'ms-1',
          label: 'Land Search, Survey & Legal Due Diligence',
          targetAmount: 80000,
          reachedAt: shiftDays(today, -62),
        },
        {
          id: 'ms-2',
          label: '50% Sale Agreement Deposit',
          targetAmount: 200000,
          reachedAt: shiftDays(today, -21),
        },
        {
          id: 'ms-3',
          label: '75% Balance Escrow Clearance',
          targetAmount: 300000,
        },
        {
          id: 'ms-4',
          label: 'Final Completion & Title Deed Transfer',
          targetAmount: 400000,
        },
      ],
      createdAt: `${m4}-10T08:00:00.000Z`,
    },
    {
      id: 2,
      title: 'End-Year Family Gala & Dividend Retreat',
      description:
        'Annual group celebration, audited ledger presentation, bonus dividend sharing, and catered family retreat for members.',
      category: 'event',
      targetAmount: 80000,
      deadline: shiftDays(today, 34),
      status: 'active',
      milestones: [
        {
          id: 'ms-2a',
          label: 'Venue Reservation Deposit',
          targetAmount: 25000,
          reachedAt: shiftDays(today, -28),
        },
        {
          id: 'ms-2b',
          label: 'Catering & Sound Booking',
          targetAmount: 55000,
          reachedAt: shiftDays(today, -6),
        },
        {
          id: 'ms-2c',
          label: 'Transport, Gifts & Full Event Budget',
          targetAmount: 80000,
        },
      ],
      createdAt: `${m2}-05T10:00:00.000Z`,
    },
    {
      id: 3,
      title: 'Member Emergency Welfare Shield',
      description:
        'Ring-fenced rapid-response solidarity reserve providing zero-interest medical, bereavement, and school-fee support to registered members.',
      category: 'welfare',
      targetAmount: 120000,
      deadline: shiftDays(today, 120),
      status: 'completed',
      milestones: [
        {
          id: 'ms-3a',
          label: 'Initial Safety Net Buffer',
          targetAmount: 40000,
          reachedAt: shiftDays(today, -85),
        },
        {
          id: 'ms-3b',
          label: 'Mid-Tier Hospitalization Cover',
          targetAmount: 80000,
          reachedAt: shiftDays(today, -45),
        },
        {
          id: 'ms-3c',
          label: '100% Fully Funded Reserve Cap',
          targetAmount: 120000,
          reachedAt: shiftDays(today, -10),
        },
      ],
      createdAt: `${m5}-12T08:30:00.000Z`,
    },
  ];

  const projectContributions: ProjectContribution[] = [
    // Project 1: Land Acquisition = 265,000 / 400,000 (66.25%)
    { projectId: 1, memberId: 1, amount: 45000, date: shiftDays(today, -55), paymentMethod: 'bank_transfer', referenceCode: 'LND-1019A', note: 'Plot share tranche 1 & 2', createdAt: `${shiftDays(today, -55)}T10:00:00Z` },
    { projectId: 1, memberId: 2, amount: 50000, date: shiftDays(today, -50), paymentMethod: 'bank_transfer', referenceCode: 'LND-1024B', note: 'Full member plot equity share', createdAt: `${shiftDays(today, -50)}T10:00:00Z` },
    { projectId: 1, memberId: 3, amount: 35000, date: shiftDays(today, -36), paymentMethod: 'mobile_transfer', referenceCode: 'SJW88K19L', note: 'M-Pesa investment deposit', createdAt: `${shiftDays(today, -36)}T10:00:00Z` },
    { projectId: 1, memberId: 4, amount: 30000, date: shiftDays(today, -29), paymentMethod: 'mobile_transfer', referenceCode: 'SJZ40M72P', note: 'Deposit signing contribution', createdAt: `${shiftDays(today, -29)}T10:00:00Z` },
    { projectId: 1, memberId: 5, amount: 35000, date: shiftDays(today, -22), paymentMethod: 'bank_transfer', referenceCode: 'LND-1088E', note: 'Agreement milestone top-up', createdAt: `${shiftDays(today, -22)}T10:00:00Z` },
    { projectId: 1, memberId: 6, amount: 40000, date: shiftDays(today, -15), paymentMethod: 'standing_order', referenceCode: 'STO-LND06', note: 'Standing investment transfer', createdAt: `${shiftDays(today, -15)}T10:00:00Z` },
    { projectId: 1, memberId: 7, amount: 15000, date: shiftDays(today, -8), paymentMethod: 'mobile_transfer', referenceCode: 'SKH29D61N', note: 'Initial land project instalment', createdAt: `${shiftDays(today, -8)}T10:00:00Z` },
    { projectId: 1, memberId: 8, amount: 15000, date: shiftDays(today, -3), paymentMethod: 'cash', referenceCode: 'CSH-LND08', note: 'Cash banked after committee visit', createdAt: `${shiftDays(today, -3)}T10:00:00Z` },

    // Project 2: End-Year Gala = 64,000 / 80,000 (80%)
    { projectId: 2, memberId: 1, amount: 10000, date: shiftDays(today, -30), paymentMethod: 'mobile_transfer', referenceCode: 'GAL-001M', note: 'Full gala ticket & family contribution', createdAt: `${shiftDays(today, -30)}T12:00:00Z` },
    { projectId: 2, memberId: 2, amount: 10000, date: shiftDays(today, -28), paymentMethod: 'mobile_transfer', referenceCode: 'GAL-002M', note: 'Full event share cleared', createdAt: `${shiftDays(today, -28)}T12:00:00Z` },
    { projectId: 2, memberId: 3, amount: 10000, date: shiftDays(today, -20), paymentMethod: 'mobile_transfer', referenceCode: 'GAL-003M', note: 'Full event share cleared', createdAt: `${shiftDays(today, -20)}T12:00:00Z` },
    { projectId: 2, memberId: 5, amount: 10000, date: shiftDays(today, -16), paymentMethod: 'cash', referenceCode: 'CSH-GAL05', note: 'Paid to catering deposit kitty', createdAt: `${shiftDays(today, -16)}T12:00:00Z` },
    { projectId: 2, memberId: 6, amount: 10000, date: shiftDays(today, -11), paymentMethod: 'bank_transfer', referenceCode: 'GAL-006B', note: 'Full gala contribution', createdAt: `${shiftDays(today, -11)}T12:00:00Z` },
    { projectId: 2, memberId: 4, amount: 8000, date: shiftDays(today, -6), paymentMethod: 'mobile_transfer', referenceCode: 'SKJ55R10T', note: 'Unlocked catering milestone', createdAt: `${shiftDays(today, -6)}T12:00:00Z` },
    { projectId: 2, memberId: 7, amount: 6000, date: shiftDays(today, -2), paymentMethod: 'mobile_transfer', referenceCode: 'SKN31B84W', note: 'First gala payment', createdAt: `${shiftDays(today, -2)}T12:00:00Z` },

    // Project 3: Welfare Shield = 120,000 / 120,000 (100%)
    { projectId: 3, memberId: 1, amount: 15000, date: shiftDays(today, -90), paymentMethod: 'mobile_transfer', referenceCode: 'WLF-101', note: 'Annual welfare subscription', createdAt: `${shiftDays(today, -90)}T09:00:00Z` },
    { projectId: 3, memberId: 2, amount: 15000, date: shiftDays(today, -88), paymentMethod: 'bank_transfer', referenceCode: 'WLF-102', note: 'Annual welfare subscription', createdAt: `${shiftDays(today, -88)}T09:00:00Z` },
    { projectId: 3, memberId: 3, amount: 15000, date: shiftDays(today, -75), paymentMethod: 'mobile_transfer', referenceCode: 'WLF-103', note: 'Annual welfare subscription', createdAt: `${shiftDays(today, -75)}T09:00:00Z` },
    { projectId: 3, memberId: 4, amount: 15000, date: shiftDays(today, -60), paymentMethod: 'mobile_transfer', referenceCode: 'WLF-104', note: 'Annual welfare subscription', createdAt: `${shiftDays(today, -60)}T09:00:00Z` },
    { projectId: 3, memberId: 5, amount: 15000, date: shiftDays(today, -46), paymentMethod: 'cash', referenceCode: 'WLF-105', note: 'Annual welfare subscription', createdAt: `${shiftDays(today, -46)}T09:00:00Z` },
    { projectId: 3, memberId: 6, amount: 15000, date: shiftDays(today, -32), paymentMethod: 'standing_order', referenceCode: 'WLF-106', note: 'Annual welfare subscription', createdAt: `${shiftDays(today, -32)}T09:00:00Z` },
    { projectId: 3, memberId: 7, amount: 15000, date: shiftDays(today, -19), paymentMethod: 'mobile_transfer', referenceCode: 'WLF-107', note: 'Annual welfare subscription', createdAt: `${shiftDays(today, -19)}T09:00:00Z` },
    { projectId: 3, memberId: 8, amount: 15000, date: shiftDays(today, -10), paymentMethod: 'mobile_transfer', referenceCode: 'WLF-108', note: 'Completed 100% welfare reserve target', createdAt: `${shiftDays(today, -10)}T09:00:00Z` },
  ];

  const settings: VaultSettings = {
    id: 'primary',
    groupName: 'Imani Heritage Chama',
    registrationNo: 'SHG/MRU/2024/0819',
    location: 'Meru, Kenya',
    currency: 'KES',
    defaultTarget: 10000,
    frequency: 'monthly',
    currentCycleMonth: currentMonth,
    rotationIntervalDays: 30,
    nextPayoutDate: shiftDays(today, 12),
    currentRound: 1,
    currentTurnOrder: 4, // member rotationOrder 4 (Brian Ochieng) is up next
    payoutPotOverride: null,
    theme: 'golden-vault',
    activeRole: 'treasurer',
    viewingMemberId: 4,
    mobileFramePreview: false,
    initializedAt: new Date().toISOString(),
  };

  const auditLog: AuditEntry[] = [
    {
      timestamp: `${shiftDays(today, -18)}T16:05:00.000Z`,
      actor: 'Wanjiku Mwenda (Treasurer)',
      category: 'payout',
      summary: 'Disbursed Round 1 · Cycle #3 payout to Amina Hassan (MGR-R1C3-932C)',
      amount: 80000,
    },
    {
      timestamp: `${shiftDays(today, -10)}T09:10:00.000Z`,
      actor: 'Wanjiku Mwenda (Treasurer)',
      category: 'project',
      summary: 'Member Emergency Welfare Shield reached 100% funding target',
      amount: 120000,
    },
    {
      timestamp: `${shiftDays(today, -6)}T12:15:00.000Z`,
      actor: 'Wanjiku Mwenda (Treasurer)',
      category: 'project',
      summary: 'Logged Brian Ochieng deposit to End-Year Family Gala (SKJ55R10T)',
      amount: 8000,
    },
    {
      timestamp: `${shiftDays(today, -4)}T11:15:00.000Z`,
      actor: 'Wanjiku Mwenda (Treasurer)',
      category: 'deposit',
      summary: 'Logged Grace Njeri M-Pesa deposit for current cycle (SKL18P53VR)',
      amount: 5500,
    },
    {
      timestamp: `${shiftDays(today, -3)}T14:20:00.000Z`,
      actor: 'Wanjiku Mwenda (Treasurer)',
      category: 'project',
      summary: 'Logged Samuel Murithi contribution to Nchiru 1-Acre Plot (CSH-LND08)',
      amount: 15000,
    },
  ];

  return {
    settings,
    members,
    contributions,
    payouts,
    projects,
    projectContributions,
    auditLog,
  };
}

export async function ensureVaultInitialized(): Promise<void> {
  const existing = await db.settings.get('primary');
  if (existing) return;

  const alreadyCleared = localStorage.getItem(SEED_FLAG_KEY) === 'cleared';
  if (alreadyCleared) {
    const today = getCurrentIsoDate();
    await db.settings.put({
      id: 'primary',
      groupName: 'My Chama Vault',
      registrationNo: 'SHG/2026/0001',
      location: 'Nairobi, Kenya',
      currency: 'KES',
      defaultTarget: 5000,
      frequency: 'monthly',
      currentCycleMonth: today.slice(0, 7),
      rotationIntervalDays: 30,
      nextPayoutDate: shiftDays(today, 14),
      currentRound: 1,
      currentTurnOrder: 1,
      payoutPotOverride: null,
      theme: 'golden-vault',
      activeRole: 'treasurer',
      viewingMemberId: 0,
      mobileFramePreview: false,
      initializedAt: new Date().toISOString(),
    });
    return;
  }

  await resetToDemoData();
}

export async function resetToDemoData(): Promise<void> {
  const seed = buildSeedDataset();
  const currentSettings = await db.settings.get('primary');
  const preservedTheme = currentSettings?.theme ?? 'golden-vault';
  const preservedFrame = currentSettings?.mobileFramePreview ?? false;

  await db.transaction(
    'rw',
    [
      db.settings,
      db.members,
      db.contributions,
      db.payouts,
      db.projects,
      db.projectContributions,
      db.auditLog,
    ],
    async () => {
      await Promise.all([
        db.members.clear(),
        db.contributions.clear(),
        db.payouts.clear(),
        db.projects.clear(),
        db.projectContributions.clear(),
        db.auditLog.clear(),
      ]);
      await db.settings.put({
        ...seed.settings,
        theme: preservedTheme,
        mobileFramePreview: preservedFrame,
      });
      await db.members.bulkAdd(seed.members);
      await db.contributions.bulkAdd(seed.contributions);
      await db.payouts.bulkAdd(seed.payouts);
      await db.projects.bulkAdd(seed.projects);
      await db.projectContributions.bulkAdd(seed.projectContributions);
      await db.auditLog.bulkAdd(seed.auditLog);
    }
  );
  localStorage.setItem(SEED_FLAG_KEY, 'demo');
}

export async function clearAllVaultRecords(): Promise<void> {
  const current = await db.settings.get('primary');
  const today = getCurrentIsoDate();
  await db.transaction(
    'rw',
    [
      db.settings,
      db.members,
      db.contributions,
      db.payouts,
      db.projects,
      db.projectContributions,
      db.auditLog,
    ],
    async () => {
      await Promise.all([
        db.members.clear(),
        db.contributions.clear(),
        db.payouts.clear(),
        db.projects.clear(),
        db.projectContributions.clear(),
        db.auditLog.clear(),
      ]);
      await db.settings.put({
        id: 'primary',
        groupName: current?.groupName ?? 'ChamaVault Group',
        registrationNo: current?.registrationNo ?? 'SHG/2026/0001',
        location: current?.location ?? 'Kenya',
        currency: current?.currency ?? 'KES',
        defaultTarget: current?.defaultTarget ?? 10000,
        frequency: current?.frequency ?? 'monthly',
        currentCycleMonth: today.slice(0, 7),
        rotationIntervalDays: current?.rotationIntervalDays ?? 30,
        nextPayoutDate: shiftDays(today, 30),
        currentRound: 1,
        currentTurnOrder: 1,
        payoutPotOverride: null,
        theme: current?.theme ?? 'golden-vault',
        activeRole: 'treasurer',
        viewingMemberId: 0,
        mobileFramePreview: current?.mobileFramePreview ?? false,
        initializedAt: new Date().toISOString(),
      });
      await db.auditLog.add({
        timestamp: new Date().toISOString(),
        actor: 'Group Treasurer',
        category: 'settings',
        summary: 'Initialized clean empty vault ledger',
      });
    }
  );
  localStorage.setItem(SEED_FLAG_KEY, 'cleared');
}

export async function updateVaultSettings(
  patch: Partial<Omit<VaultSettings, 'id'>>,
  options?: { syncAllMemberTargets?: boolean; auditSummary?: string }
): Promise<void> {
  await db.transaction('rw', [db.settings, db.members, db.auditLog], async () => {
    const existing = await db.settings.get('primary');
    if (!existing) return;
    await db.settings.put({ ...existing, ...patch });

    if (options?.syncAllMemberTargets && typeof patch.defaultTarget === 'number') {
      const target = patch.defaultTarget;
      await db.members.toCollection().modify({ monthlyTarget: target });
    }

    if (options?.auditSummary) {
      await db.auditLog.add({
        timestamp: new Date().toISOString(),
        actor: 'Group Treasurer',
        category: 'settings',
        summary: options.auditSummary,
      });
    }
  });
}

const AVATAR_PALETTES = [
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-blue-600',
  'from-violet-500 to-indigo-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
  'from-amber-400 to-yellow-600',
  'from-teal-500 to-emerald-600',
];

export async function registerMember(input: {
  name: string;
  phone: string;
  email: string;
  title: string;
  monthlyTarget: number;
  joinedDate: string;
  status: 'active' | 'paused';
  notes: string;
}): Promise<number> {
  return db.transaction('rw', [db.members, db.settings, db.auditLog], async () => {
    const all = await db.members.toArray();
    const maxOrder = all.reduce((acc, m) => Math.max(acc, m.rotationOrder), 0);
    const maxCodeNum = all.reduce((acc, m) => {
      const parsed = parseInt(m.memberCode.replace(/\D/g, ''), 10);
      return Number.isFinite(parsed) ? Math.max(acc, parsed) : acc;
    }, 0);
    const memberCode = `CV-${String(maxCodeNum + 1).padStart(3, '0')}`;
    const avatarHue = AVATAR_PALETTES[all.length % AVATAR_PALETTES.length];

    const id = await db.members.add({
      memberCode,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      title: input.title.trim() || 'Member',
      avatarHue,
      joinedDate: input.joinedDate,
      monthlyTarget: Math.max(0, Number(input.monthlyTarget) || 0),
      rotationOrder: maxOrder + 1,
      status: input.status,
      notes: input.notes.trim(),
    });

    const settings = await db.settings.get('primary');
    if (settings && (!settings.viewingMemberId || all.length === 0)) {
      await db.settings.update('primary', {
        viewingMemberId: id,
        currentTurnOrder: all.length === 0 ? maxOrder + 1 : settings.currentTurnOrder,
      });
    }

    await db.auditLog.add({
      timestamp: new Date().toISOString(),
      actor: 'Group Treasurer',
      category: 'member',
      summary: `Registered member ${input.name.trim()} (${memberCode})`,
    });

    return id;
  });
}

export async function updateMemberProfile(
  id: number,
  patch: Partial<Omit<Member, 'id' | 'memberCode'>>
): Promise<void> {
  await db.transaction('rw', [db.members, db.auditLog], async () => {
    const existing = await db.members.get(id);
    if (!existing) return;
    await db.members.update(id, patch);
    await db.auditLog.add({
      timestamp: new Date().toISOString(),
      actor: 'Group Treasurer',
      category: 'member',
      summary: `Updated profile for ${patch.name ?? existing.name} (${existing.memberCode})`,
    });
  });
}

export async function deleteMemberRecord(id: number): Promise<void> {
  await db.transaction(
    'rw',
    [db.members, db.contributions, db.projectContributions, db.settings, db.auditLog],
    async () => {
      const existing = await db.members.get(id);
      if (!existing) return;
      await db.contributions.where('memberId').equals(id).delete();
      await db.projectContributions.where('memberId').equals(id).delete();
      await db.members.delete(id);

      // Normalize rotation orders
      const remaining = await db.members.orderBy('rotationOrder').toArray();
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].rotationOrder !== i + 1) {
          await db.members.update(remaining[i].id!, { rotationOrder: i + 1 });
        }
      }

      const settings = await db.settings.get('primary');
      if (settings) {
        const nextViewing =
          settings.viewingMemberId === id
            ? remaining[0]?.id ?? 0
            : settings.viewingMemberId;
        const clampedTurn = Math.min(
          Math.max(1, settings.currentTurnOrder),
          Math.max(1, remaining.length)
        );
        await db.settings.update('primary', {
          viewingMemberId: nextViewing,
          currentTurnOrder: clampedTurn,
        });
      }

      await db.auditLog.add({
        timestamp: new Date().toISOString(),
        actor: 'Group Treasurer',
        category: 'member',
        summary: `Removed member ${existing.name} (${existing.memberCode}) and linked deposits`,
      });
    }
  );
}

export async function logContribution(input: {
  memberId: number;
  amount: number;
  date: string;
  cycleMonth: string;
  paymentMethod: PaymentMethod;
  referenceCode: string;
  category: ContributionCategory;
  note: string;
}): Promise<number> {
  return db.transaction('rw', [db.contributions, db.members, db.auditLog], async () => {
    const member = await db.members.get(input.memberId);
    const cleanAmount = Math.max(1, Math.round(Number(input.amount) * 100) / 100);
    const ref =
      input.referenceCode.trim() ||
      `CV-${Date.now().toString(36).toUpperCase().slice(-6)}`;

    const id = await db.contributions.add({
      memberId: input.memberId,
      amount: cleanAmount,
      date: input.date,
      cycleMonth: input.cycleMonth,
      paymentMethod: input.paymentMethod,
      referenceCode: ref,
      category: input.category,
      note: input.note.trim(),
      recordedBy: 'Group Treasurer',
      createdAt: new Date().toISOString(),
    });

    await db.auditLog.add({
      timestamp: new Date().toISOString(),
      actor: 'Group Treasurer',
      category: 'deposit',
      summary: `Logged deposit from ${member?.name ?? 'Member'} (${ref}) for ${input.cycleMonth}`,
      amount: cleanAmount,
    });

    return id;
  });
}

export async function deleteContribution(id: number): Promise<void> {
  await db.transaction('rw', [db.contributions, db.members, db.auditLog], async () => {
    const entry = await db.contributions.get(id);
    if (!entry) return;
    const member = await db.members.get(entry.memberId);
    await db.contributions.delete(id);
    await db.auditLog.add({
      timestamp: new Date().toISOString(),
      actor: 'Group Treasurer',
      category: 'deposit',
      summary: `Reversed deposit ${entry.referenceCode} for ${member?.name ?? 'Member'}`,
      amount: entry.amount,
    });
  });
}

export async function disburseRotationPayout(input: {
  memberId: number;
  amount: number;
  paidDate: string;
  paymentMethod: PaymentMethod;
  referenceCode: string;
  notes: string;
}): Promise<number> {
  return db.transaction('rw', [db.payouts, db.members, db.settings, db.auditLog], async () => {
    const settings = await db.settings.get('primary');
    if (!settings) throw new Error('Vault settings not initialized');

    const activeMembers = (await db.members.orderBy('rotationOrder').toArray()).filter(
      (m) => m.status === 'active'
    );
    const recipient = await db.members.get(input.memberId);
    const existingPayouts = await db.payouts.toArray();
    const roundPayouts = existingPayouts.filter(
      (p) => p.roundNumber === settings.currentRound
    );
    const cycleNumber = roundPayouts.length + 1;
    const ref =
      input.referenceCode.trim() ||
      `MGR-R${settings.currentRound}C${cycleNumber}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

    const id = await db.payouts.add({
      roundNumber: settings.currentRound,
      cycleNumber,
      memberId: input.memberId,
      amount: input.amount,
      scheduledDate: settings.nextPayoutDate,
      paidDate: input.paidDate,
      status: 'completed',
      paymentMethod: input.paymentMethod,
      referenceCode: ref,
      notes: input.notes.trim(),
      createdAt: new Date().toISOString(),
    });

    // Advance queue to the next active member
    let nextTurnOrder = settings.currentTurnOrder;
    let nextRound = settings.currentRound;
    if (activeMembers.length > 0) {
      const idx = activeMembers.findIndex((m) => m.id === input.memberId);
      const nextIdx = (idx + 1) % activeMembers.length;
      if (idx >= 0 && nextIdx === 0) {
        nextRound = settings.currentRound + 1;
      }
      nextTurnOrder = activeMembers[nextIdx].rotationOrder;
    }

    const baseDate =
      input.paidDate > settings.nextPayoutDate ? input.paidDate : settings.nextPayoutDate;
    const nextDate = shiftDays(baseDate, settings.rotationIntervalDays || 30);

    await db.settings.update('primary', {
      currentTurnOrder: nextTurnOrder,
      currentRound: nextRound,
      nextPayoutDate: nextDate,
    });

    await db.auditLog.add({
      timestamp: new Date().toISOString(),
      actor: 'Group Treasurer',
      category: 'payout',
      summary: `Disbursed Round ${settings.currentRound} · Cycle #${cycleNumber} payout to ${recipient?.name ?? 'Member'} (${ref})`,
      amount: input.amount,
    });

    return id;
  });
}

export async function skipCurrentRotationTurn(reason: string): Promise<void> {
  await db.transaction('rw', [db.payouts, db.members, db.settings, db.auditLog], async () => {
    const settings = await db.settings.get('primary');
    if (!settings) return;
    const activeMembers = (await db.members.orderBy('rotationOrder').toArray()).filter(
      (m) => m.status === 'active'
    );
    if (activeMembers.length < 2) return;

    const currentIdx = Math.max(
      0,
      activeMembers.findIndex((m) => m.rotationOrder >= settings.currentTurnOrder)
    );
    const skippedMember = activeMembers[currentIdx];
    const nextIdx = (currentIdx + 1) % activeMembers.length;
    const nextRound = nextIdx === 0 ? settings.currentRound + 1 : settings.currentRound;

    await db.settings.update('primary', {
      currentTurnOrder: activeMembers[nextIdx].rotationOrder,
      currentRound: nextRound,
    });

    await db.auditLog.add({
      timestamp: new Date().toISOString(),
      actor: 'Group Treasurer',
      category: 'payout',
      summary: `Deferred ${skippedMember.name}'s turn to next round${reason.trim() ? `: ${reason.trim()}` : ''}`,
    });
  });
}

export async function swapMemberRotationSlots(
  memberIdA: number,
  memberIdB: number
): Promise<void> {
  await db.transaction('rw', [db.members, db.auditLog], async () => {
    const memberA = await db.members.get(memberIdA);
    const memberB = await db.members.get(memberIdB);
    if (!memberA || !memberB || memberA.id === memberB.id) return;

    await db.members.update(memberA.id!, { rotationOrder: memberB.rotationOrder });
    await db.members.update(memberB.id!, { rotationOrder: memberA.rotationOrder });

    await db.auditLog.add({
      timestamp: new Date().toISOString(),
      actor: 'Group Treasurer',
      category: 'payout',
      summary: `Swapped rotation slots: ${memberA.name} (#${memberB.rotationOrder}) ↔ ${memberB.name} (#${memberA.rotationOrder})`,
    });
  });
}

export async function updateContribution(
  id: number,
  input: {
    memberId: number;
    amount: number;
    date: string;
    cycleMonth: string;
    paymentMethod: PaymentMethod;
    referenceCode: string;
    category: ContributionCategory;
    note: string;
  }
): Promise<void> {
  await db.transaction('rw', [db.contributions, db.members, db.auditLog], async () => {
    const existing = await db.contributions.get(id);
    if (!existing) return;
    const member = await db.members.get(input.memberId);
    const cleanAmount = Math.max(1, Math.round(Number(input.amount) * 100) / 100);
    const ref = input.referenceCode.trim() || existing.referenceCode;

    await db.contributions.update(id, {
      memberId: input.memberId,
      amount: cleanAmount,
      date: input.date,
      cycleMonth: input.cycleMonth,
      paymentMethod: input.paymentMethod,
      referenceCode: ref,
      category: input.category,
      note: input.note.trim(),
    });

    await db.auditLog.add({
      timestamp: new Date().toISOString(),
      actor: 'Group Treasurer',
      category: 'deposit',
      summary: `Updated deposit ${ref} for ${member?.name ?? 'Member'}`,
      amount: cleanAmount,
    });
  });
}

export async function setNextRotationBeneficiary(memberId: number): Promise<void> {
  await db.transaction('rw', [db.members, db.settings, db.auditLog], async () => {
    const member = await db.members.get(memberId);
    if (!member || member.status !== 'active') return;
    await db.settings.update('primary', { currentTurnOrder: member.rotationOrder });
    await db.auditLog.add({
      timestamp: new Date().toISOString(),
      actor: 'Group Treasurer',
      category: 'payout',
      summary: `Set ${member.name} (Slot #${member.rotationOrder}) as active next beneficiary`,
    });
  });
}

export async function createFundraiserProject(input: {
  title: string;
  description: string;
  category: ProjectCategory;
  targetAmount: number;
  deadline: string;
  milestones: Array<{ label: string; targetAmount: number }>;
}): Promise<number> {
  return db.transaction('rw', [db.projects, db.auditLog], async () => {
    const sortedMilestones: ProjectMilestone[] = input.milestones
      .filter((m) => m.label.trim() && m.targetAmount > 0)
      .sort((a, b) => a.targetAmount - b.targetAmount)
      .map((m, idx) => ({
        id: `ms-${Date.now()}-${idx}`,
        label: m.label.trim(),
        targetAmount: Number(m.targetAmount),
      }));

    const id = await db.projects.add({
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      targetAmount: Math.max(1, Number(input.targetAmount)),
      deadline: input.deadline,
      status: 'active',
      milestones: sortedMilestones,
      createdAt: new Date().toISOString(),
    });

    await db.auditLog.add({
      timestamp: new Date().toISOString(),
      actor: 'Group Treasurer',
      category: 'project',
      summary: `Launched fundraiser "${input.title.trim()}"`,
      amount: Number(input.targetAmount),
    });

    return id;
  });
}

export async function updateFundraiserProject(
  id: number,
  patch: Partial<Omit<FundraiserProject, 'id' | 'createdAt'>>
): Promise<void> {
  await db.transaction(
    'rw',
    [db.projects, db.projectContributions, db.auditLog],
    async () => {
      const existing = await db.projects.get(id);
      if (!existing) return;

      const updated: FundraiserProject = { ...existing, ...patch };
      const contribs = await db.projectContributions.where('projectId').equals(id).toArray();
      const raised = contribs.reduce((sum, c) => sum + c.amount, 0);
      const today = getCurrentIsoDate();

      updated.milestones = [...updated.milestones]
        .sort((a, b) => a.targetAmount - b.targetAmount)
        .map((m) => ({
          ...m,
          reachedAt:
            raised >= m.targetAmount ? m.reachedAt || today : undefined,
        }));

      await db.projects.put(updated);
      await db.auditLog.add({
        timestamp: new Date().toISOString(),
        actor: 'Group Treasurer',
        category: 'project',
        summary: `Updated project "${updated.title}"`,
      });
    }
  );
}

export async function deleteFundraiserProject(id: number): Promise<void> {
  await db.transaction(
    'rw',
    [db.projects, db.projectContributions, db.auditLog],
    async () => {
      const existing = await db.projects.get(id);
      if (!existing) return;
      await db.projectContributions.where('projectId').equals(id).delete();
      await db.projects.delete(id);
      await db.auditLog.add({
        timestamp: new Date().toISOString(),
        actor: 'Group Treasurer',
        category: 'project',
        summary: `Archived & removed fundraiser "${existing.title}"`,
      });
    }
  );
}

export async function logProjectContribution(input: {
  projectId: number;
  memberId: number;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  referenceCode: string;
  note: string;
}): Promise<number> {
  return db.transaction(
    'rw',
    [db.projectContributions, db.projects, db.members, db.auditLog],
    async () => {
      const project = await db.projects.get(input.projectId);
      const member = await db.members.get(input.memberId);
      if (!project) throw new Error('Project not found');

      const cleanAmount = Math.max(1, Math.round(Number(input.amount) * 100) / 100);
      const ref =
        input.referenceCode.trim() ||
        `PRJ-${Date.now().toString(36).toUpperCase().slice(-6)}`;

      const id = await db.projectContributions.add({
        projectId: input.projectId,
        memberId: input.memberId,
        amount: cleanAmount,
        date: input.date,
        paymentMethod: input.paymentMethod,
        referenceCode: ref,
        note: input.note.trim(),
        createdAt: new Date().toISOString(),
      });

      // Recalculate milestones and auto-complete status if target achieved
      const allContribs = await db.projectContributions
        .where('projectId')
        .equals(input.projectId)
        .toArray();
      const totalRaised = allContribs.reduce((sum, c) => sum + c.amount, 0);

      const updatedMilestones = project.milestones.map((ms) => {
        if (totalRaised >= ms.targetAmount && !ms.reachedAt) {
          return { ...ms, reachedAt: input.date };
        }
        return ms;
      });

      const nextStatus: ProjectStatus =
        totalRaised >= project.targetAmount ? 'completed' : project.status;

      await db.projects.update(input.projectId, {
        milestones: updatedMilestones,
        status: nextStatus,
      });

      await db.auditLog.add({
        timestamp: new Date().toISOString(),
        actor: 'Group Treasurer',
        category: 'project',
        summary: `Logged ${member?.name ?? 'Member'} contribution to "${project.title}" (${ref})`,
        amount: cleanAmount,
      });

      return id;
    }
  );
}

export async function deleteProjectContribution(id: number): Promise<void> {
  await db.transaction(
    'rw',
    [db.projectContributions, db.projects, db.members, db.auditLog],
    async () => {
      const entry = await db.projectContributions.get(id);
      if (!entry) return;
      const project = await db.projects.get(entry.projectId);
      const member = await db.members.get(entry.memberId);

      await db.projectContributions.delete(id);

      if (project) {
        const remaining = await db.projectContributions
          .where('projectId')
          .equals(entry.projectId)
          .toArray();
        const totalRaised = remaining.reduce((sum, c) => sum + c.amount, 0);
        const updatedMilestones = project.milestones.map((ms) => ({
          ...ms,
          reachedAt: totalRaised >= ms.targetAmount ? ms.reachedAt : undefined,
        }));
        const nextStatus: ProjectStatus =
          project.status === 'completed' && totalRaised < project.targetAmount
            ? 'active'
            : project.status;
        await db.projects.update(project.id!, {
          milestones: updatedMilestones,
          status: nextStatus,
        });
      }

      await db.auditLog.add({
        timestamp: new Date().toISOString(),
        actor: 'Group Treasurer',
        category: 'project',
        summary: `Removed contribution ${entry.referenceCode} by ${member?.name ?? 'Member'}`,
        amount: entry.amount,
      });
    }
  );
}

export async function exportVaultBackup(): Promise<VaultBackupPayload> {
  const [settings, members, contributions, payouts, projects, projectContributions, auditLog] =
    await Promise.all([
      db.settings.get('primary'),
      db.members.toArray(),
      db.contributions.toArray(),
      db.payouts.toArray(),
      db.projects.toArray(),
      db.projectContributions.toArray(),
      db.auditLog.toArray(),
    ]);

  if (!settings) {
    throw new Error('Vault settings missing');
  }

  return {
    schemaVersion: 1,
    app: 'ChamaVault',
    exportedAt: new Date().toISOString(),
    settings,
    members,
    contributions,
    payouts,
    projects,
    projectContributions,
    auditLog,
  };
}

export async function importVaultBackup(payload: VaultBackupPayload): Promise<void> {
  if (
    !payload ||
    payload.app !== 'ChamaVault' ||
    !payload.settings ||
    !Array.isArray(payload.members) ||
    !Array.isArray(payload.contributions)
  ) {
    throw new Error('Invalid ChamaVault backup file format.');
  }

  await db.transaction(
    'rw',
    [
      db.settings,
      db.members,
      db.contributions,
      db.payouts,
      db.projects,
      db.projectContributions,
      db.auditLog,
    ],
    async () => {
      await Promise.all([
        db.members.clear(),
        db.contributions.clear(),
        db.payouts.clear(),
        db.projects.clear(),
        db.projectContributions.clear(),
        db.auditLog.clear(),
      ]);

      await db.settings.put({ ...payload.settings, id: 'primary' });
      if (payload.members.length) await db.members.bulkAdd(payload.members);
      if (payload.contributions.length) await db.contributions.bulkAdd(payload.contributions);
      if (payload.payouts?.length) await db.payouts.bulkAdd(payload.payouts);
      if (payload.projects?.length) await db.projects.bulkAdd(payload.projects);
      if (payload.projectContributions?.length) {
        await db.projectContributions.bulkAdd(payload.projectContributions);
      }
      if (payload.auditLog?.length) await db.auditLog.bulkAdd(payload.auditLog);

      await db.auditLog.add({
        timestamp: new Date().toISOString(),
        actor: 'Group Treasurer',
        category: 'settings',
        summary: `Restored vault backup from ${payload.exportedAt.slice(0, 10)} (${payload.members.length} members)`,
      });
    }
  );
  localStorage.setItem(SEED_FLAG_KEY, 'imported');
}
