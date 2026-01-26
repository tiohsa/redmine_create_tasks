import { getApiHeaders } from './apiUtils';
import { t } from '../i18n';
import { getApiUrl } from '../utils/url';

type AiSettings = {
  provider: 'gemini' | 'azure-openai';
  prompt: string;
};

export const fetchAiSettings = async (projectId: string): Promise<AiSettings> => {
  const response = await fetch(getApiUrl(`projects/${projectId}/redmine_create_tasks/ai/settings`));
  if (!response.ok) {
    throw new Error(t('redmine_create_tasks.app.ai_settings_load_failed', 'Failed to load AI settings.'));
  }
  return response.json();
};

export const fetchAiDefaults = async (projectId: string): Promise<AiSettings> => {
  const response = await fetch(getApiUrl(`projects/${projectId}/redmine_create_tasks/ai/defaults`));
  if (!response.ok) {
    throw new Error(t('redmine_create_tasks.app.ai_defaults_load_failed', 'Failed to load defaults.'));
  }
  return response.json();
};

export const updateAiSettings = async (
  projectId: string,
  payload: AiSettings
): Promise<AiSettings> => {
  const response = await fetch(getApiUrl(`projects/${projectId}/redmine_create_tasks/ai/settings`), {
    method: 'PUT',
    headers: getApiHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(t('redmine_create_tasks.app.ai_settings_save_failed', 'Failed to save AI settings.'));
  }
  return response.json();
};
