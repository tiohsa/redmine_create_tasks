type TranslationMap = Record<string, string>;


const translations: TranslationMap = window.createTasksI18n || {};
const fallbackTranslations: TranslationMap = window.createTasksI18nFallback || {};

const interpolate = (template: string, params?: Record<string, string | number>): string => {
  if (!params) return template;
  return template.replace(/%\{([^}]+)\}/g, (_match, key) => {
    const value = params[key];
    return value === undefined || value === null ? '' : String(value);
  });
};

export const t = (
  key: string,
  fallback?: string,
  params?: Record<string, string | number>
): string => {
  const value = translations[key] || fallbackTranslations[key];
  return interpolate(value || fallback || key, params);
};
