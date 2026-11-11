export const REASONS = ['График', 'Оплата и KPI', 'Обучение', 'Нагрузка', 'Руководитель', 'Другая работа', 'Личные обстоятельства', 'Не указана'];
export const UNITS = ['Магазин «Центр»', 'Магазин «Север»', 'Магазин «Парк»', 'Склад', 'Отдел продаж', 'Офис'];
export const ROLES = ['Продавец-консультант', 'Кассир', 'Кладовщик', 'Комплектовщик', 'Менеджер продаж', 'Офисный специалист'];
export const SOURCES = ['Сотрудник', 'HR', 'Руководитель'];
export const STATUSES = ['Запланировано', 'В работе', 'Выполнено'];
export const TODAY = '2026-11-11';
const dayMs = 86400000;
export function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function tenure(record) { return Math.round((Date.parse(record.left) - Date.parse(record.hired)) / dayMs); }
export function isEarly(record) { return tenure(record) < 90; }
export function validateExit(record) {
  if (!record || !/^DEMO-\d{3,6}$/.test(record.code)) return 'Укажите код вида DEMO-055.';
  if (!UNITS.includes(record.unit) || !ROLES.includes(record.role)) return 'Выберите подразделение и должность.';
  if (!validDate(record.hired) || !validDate(record.left) || record.left < record.hired || record.left > TODAY) return 'Проверьте даты: увольнение не раньше найма и не позже 11.11.2026.';
  if (!REASONS.includes(record.reason) || !SOURCES.includes(record.source)) return 'Выберите причину и источник.';
  if (!['По инициативе сотрудника', 'По инициативе компании', 'По соглашению сторон'].includes(record.initiative)) return 'Укажите инициатора ухода.';
  if (typeof record.comment !== 'string' || record.comment.length > 1000) return 'Комментарий — до 1000 символов.';
  return null;
}
export function filterExits(records, filters) {
  return records.filter(r => (!filters.unit || r.unit === filters.unit) && (!filters.reason || r.reason === filters.reason) && (!filters.early || isEarly(r)) && (!filters.period || r.left >= filters.period) && (!filters.query || `${r.code} ${r.role} ${r.comment}`.toLowerCase().includes(filters.query.toLowerCase())));
}
export function summarize(records) {
  const early = records.filter(isEarly);
  const known = records.filter(r => r.reason !== 'Не указана');
  return { total: records.length, early: early.length, earlyPercent: records.length ? Math.round(early.length / records.length * 100) : 0, known: known.length, coverage: records.length ? Math.round(known.length / records.length * 100) : 0, reasons: REASONS.map(reason => ({ reason, count: early.filter(r => r.reason === reason).length })).filter(r => r.count).sort((a,b) => b.count - a.count) };
}
export function insights(records) {
  const early = records.filter(isEarly);
  return UNITS.flatMap(unit => REASONS.filter(r => r !== 'Не указана').map(reason => {
    const group = early.filter(r => r.unit === unit);
    const matching = group.filter(r => r.reason === reason);
    return { key: `${unit}|${reason}`, unit, reason, count: matching.length, total: group.length, records: matching };
  })).filter(i => i.count >= 3).sort((a,b) => b.count - a.count);
}
export function csv(records) {
  const quote = value => { const str = String(value ?? ''); return '"' + (/^[=+@\-\t\r]/.test(str) ? "'" + str : str).replaceAll('"','""') + '"'; };
  return '\ufeff' + [['Код','Подразделение','Должность','Приём','Увольнение','Дней работы','Причина','Источник','Инициатива','Комментарий'], ...records.map(r => [r.code,r.unit,r.role,r.hired,r.left,tenure(r),r.reason,r.source,r.initiative,r.comment])].map(row => row.map(quote).join(';')).join('\r\n');
}
export function validateState(state) {
  const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(value);
  const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  return Boolean(state && state.version === 1 && Array.isArray(state.exits) && state.exits.length <= 5000 && state.exits.every(r => !validateExit(r) && safeId(r.id)) && new Set(state.exits.map(r => r.code)).size === state.exits.length && new Set(state.exits.map(r => r.id)).size === state.exits.length && Array.isArray(state.actions) && state.actions.length <= 5000 && state.actions.every(a => a && safeId(a.id) && UNITS.includes(a.unit) && REASONS.includes(a.reason) && a.key === `${a.unit}|${a.reason}` && text(a.title,160) && text(a.owner,100) && text(a.note,1000) && validDate(a.due) && STATUSES.includes(a.status)) && new Set(state.actions.map(a => a.id)).size === state.actions.length);
}
