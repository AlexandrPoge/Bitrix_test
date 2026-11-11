export const REASONS = ['График', 'Оплата и KPI', 'Обучение', 'Нагрузка', 'Руководитель', 'Другая работа', 'Личные обстоятельства', 'Не указана'];
export const UNITS = ['Магазин «Центр»', 'Магазин «Север»', 'Магазин «Парк»', 'Склад', 'Отдел продаж', 'Офис'];
export const ROLES = ['Продавец-консультант', 'Кассир', 'Кладовщик', 'Комплектовщик', 'Менеджер продаж', 'Офисный специалист'];
export const SOURCES = ['Сотрудник', 'HR', 'Руководитель'];
export const STATUSES = ['Запланировано', 'В работе', 'Выполнено'];
export const STAGES = ['Вакансия', 'Собеседование', 'До выхода', 'Первая смена', 'Первые две недели', 'Первый месяц'];
export const OUTCOMES = ['Ещё не проверено', 'Есть улучшение', 'Улучшения нет', 'Недостаточно данных'];
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
export function experimentDefaults(reason) {
  const settings = {
    'График': ['До выхода', 'Не менее 4 из 5 новичков подтвердят на 14-й день, что график совпал с согласованным до выхода.'],
    'Обучение': ['Первая смена', 'У всех 5 новичков до первой смены назначен наставник; не менее 4 знают, к кому обращаться за помощью.'],
    'Оплата и KPI': ['Собеседование', 'Не менее 4 из 5 новичков смогут объяснить расчёт первой выплаты и премии до выхода на работу.'],
    'Нагрузка': ['Первые две недели', 'Не менее 4 из 5 новичков подтвердят на 14-й день, что нагрузка соответствует обсуждённой при найме.']
  };
  const [stage, successCriteria] = settings[reason] || ['Первый месяц', 'Провести разговор с каждым из 5 новичков на 14-й день и проверить, повторилась ли выбранная проблема.'];
  return { stage, cohortSize: 5, successCriteria, reviewDate: '2026-12-09', outcome: OUTCOMES[0], resultNote: '' };
}
export function validateExperiment(action) {
  if (!STAGES.includes(action.stage)) return 'Выберите этап, который меняем.';
  if (!Number.isInteger(action.cohortSize) || action.cohortSize < 1 || action.cohortSize > 100) return 'Размер группы — целое число от 1 до 100.';
  if (typeof action.successCriteria !== 'string' || !action.successCriteria.trim() || action.successCriteria.length > 1000) return 'Опишите критерий успеха (до 1000 символов).';
  if (!validDate(action.reviewDate) || action.reviewDate < action.due) return 'Дата проверки должна быть не раньше срока внедрения.';
  if (!OUTCOMES.includes(action.outcome) || typeof action.resultNote !== 'string' || action.resultNote.length > 1000) return 'Проверьте итог эксперимента.';
  if (action.outcome !== OUTCOMES[0] && !action.resultNote.trim()) return 'Для итога добавьте наблюдения: что именно удалось проверить.';
  return null;
}
export function migrateState(state) {
  if (!validateState(state)) throw new Error('Неверный формат данных.');
  if (state.version === 2) return state;
  return { ...state, version: 2, actions: state.actions.map(action => ({ ...action, ...experimentDefaults(action.reason), reviewDate: action.due > '2026-12-09' ? action.due : '2026-12-09' })) };
}
export function compareReasons(records) {
  const early = records.filter(isEarly), late = records.filter(r => !isEarly(r));
  return { earlyTotal: early.length, lateTotal: late.length, sufficient: early.length >= 5 && late.length >= 5,
    reasons: REASONS.filter(reason => reason !== 'Не указана').map(reason => {
      const earlyCount = early.filter(r => r.reason === reason).length;
      const lateCount = late.filter(r => r.reason === reason).length;
      return { reason, earlyCount, lateCount, earlyPercent: early.length ? Math.round(earlyCount / early.length * 100) : 0, latePercent: late.length ? Math.round(lateCount / late.length * 100) : 0 };
    }).filter(r => r.earlyCount || r.lateCount).sort((a,b) => b.earlyCount - a.earlyCount) };
}
export function validateState(state) {
  const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(value);
  const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  return Boolean(state && [1,2].includes(state.version) && Array.isArray(state.exits) && state.exits.length <= 5000 && state.exits.every(r => !validateExit(r) && safeId(r.id)) && new Set(state.exits.map(r => r.code)).size === state.exits.length && new Set(state.exits.map(r => r.id)).size === state.exits.length && Array.isArray(state.actions) && state.actions.length <= 5000 && state.actions.every(a => a && safeId(a.id) && UNITS.includes(a.unit) && REASONS.includes(a.reason) && a.key === `${a.unit}|${a.reason}` && text(a.title,160) && text(a.owner,100) && text(a.note,1000) && validDate(a.due) && STATUSES.includes(a.status) && (state.version === 1 || !validateExperiment(a))) && new Set(state.actions.map(a => a.id)).size === state.actions.length);
}
