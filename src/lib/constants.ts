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
