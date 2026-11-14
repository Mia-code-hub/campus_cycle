export const CATEGORIES = [
  { value: 'textbook', label: '教材' },
  { value: 'bedding', label: '被褥' },
  { value: 'stationery', label: '文具' },
  { value: 'appliance', label: '小家电' },
  { value: 'daily', label: '日用品' },
  { value: 'clothing', label: '衣物' },
  { value: 'other', label: '其他' },
];

export const CONDITIONS = ['95新', '9成新', '8成新', '可用'];

export const MODES = ['sale', 'donate'];

export function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function modeLabel(mode: string): string {
  return mode === 'donate' ? '公益捐赠' : '低价转售';
}

export const ITEM_STATUS_LABEL: Record<string, string> = {
  listed: '在架',
  reserved: '已预留',
  completed: '已成交',
  removed: '已下架',
};

export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  approved: '已同意',
  rejected: '已拒绝',
  completed: '已完成',
  cancelled: '已取消',
};
