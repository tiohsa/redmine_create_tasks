import { t } from '../i18n';

export interface MasterData {
    trackers: { id: number; name: string }[];
    users: { id: number; name: string }[];
    issue_statuses: { id: number; name: string }[];
    priorities: { id: number; name: string }[];
    categories: { id: number; name: string }[];
}

export const fetchMasterData = async (projectId: string): Promise<MasterData> => {
    const response = await fetch(`/projects/${projectId}/create_tasks/data`, {
        method: 'GET',
    });

    if (!response.ok) {
        throw new Error(t('create_tasks.errors.master_data_failed', 'Failed to load master data.'));
    }

    return response.json();
};
