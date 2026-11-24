export function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDateBr(isoDate: string): string {
  if (!isoDate) return 'Sem validade';
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentIsoWeekKey(): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export type ExpiryState = 'expired' | 'expiring_soon' | 'fresh' | 'none';

export function getExpiryStatus(expiryDate: string): {
  state: ExpiryState;
  daysLeft: number | null;
  label: string;
} {
  if (!expiryDate) {
    return { state: 'none', daysLeft: null, label: 'Sem data' };
  }
  const today = new Date(`${getTodayIso()}T00:00:00`);
  const target = new Date(`${expiryDate.slice(0, 10)}T00:00:00`);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return { state: 'expired', daysLeft: diffDays, label: `Vencido há ${Math.abs(diffDays)}d` };
  }
  if (diffDays === 0) {
    return { state: 'expiring_soon', daysLeft: 0, label: 'Vence hoje' };
  }
  if (diffDays <= 4) {
    return { state: 'expiring_soon', daysLeft: diffDays, label: `Vence em ${diffDays}d` };
  }
  return { state: 'fresh', daysLeft: diffDays, label: formatDateBr(expiryDate) };
}
