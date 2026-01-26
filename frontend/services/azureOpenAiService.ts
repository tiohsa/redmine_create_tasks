import { getApiHeaders } from './apiUtils';
import { getApiUrl, getProjectIdentifier } from '../utils/url';

type AiExtractResponse = {
  tasks: string[];
};


export const expandNodeWithAzureOpenAi = async (
  topic: string,
  promptOverride?: string
): Promise<string[]> => {
  const response = await fetch(getApiUrl(`projects/${getProjectIdentifier()}/redmine_create_tasks/ai/extract`), {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify({ topic, provider: 'azure-openai', prompt: promptOverride })
  });

  if (!response.ok) {
    let message = 'AI extraction failed';
    try {
      const errorPayload = (await response.json()) as { error?: string };
      if (errorPayload.error) {
        message = errorPayload.error;
      }
    } catch {
      // ignore non-JSON error responses
    }
    throw new Error(message);
  }

  const data = (await response.json()) as AiExtractResponse;
  return Array.isArray(data.tasks) ? data.tasks : [];
};
