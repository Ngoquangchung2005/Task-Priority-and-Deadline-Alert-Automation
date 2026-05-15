export const OPEN_STATUSES = new Set(['PENDING', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'OVERDUE']);

export const getDaysLeft = (deadline) => {
  if (!deadline) return null;
  const target = new Date(deadline);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

export const withDeadlineState = (item) => ({
  ...item,
  daysLeft: item.daysLeft ?? getDaysLeft(item.deadline)
});

export const isVisibleWorkItem = (item) => (
  item
  && !item.archived
  && !item.parentArchived
  && item.status !== 'CANCELLED'
  && item.parentStatus !== 'CANCELLED'
);

export const isOpen = (item) => isVisibleWorkItem(item) && OPEN_STATUSES.has(item.status);

export const isOverdue = (item) => {
  const daysLeft = item.daysLeft ?? getDaysLeft(item.deadline);
  return isVisibleWorkItem(item) && daysLeft !== null && daysLeft < 0 && item.status !== 'DONE';
};

export const isDueSoon = (item, days = 3) => {
  const daysLeft = item.daysLeft ?? getDaysLeft(item.deadline);
  return isVisibleWorkItem(item) && daysLeft !== null && daysLeft >= 0 && daysLeft <= days && item.status !== 'DONE';
};

export const emailName = (email) => email?.split('@')[0] || 'Unassigned';

export const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const countBy = (items, keyGetter) => (
  items.reduce((acc, item) => {
    const key = keyGetter(item) || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})
);

export const toChartRows = (counts, labelKey = 'name', valueKey = 'value') => (
  Object.entries(counts).map(([key, value]) => ({ [labelKey]: key, [valueKey]: value }))
);

const csvEscape = (value) => {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

export const exportCsv = (filename, headers, rows) => {
  const csv = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
