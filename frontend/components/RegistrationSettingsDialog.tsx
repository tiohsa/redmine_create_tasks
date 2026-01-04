import React, { useState, useEffect } from 'react';
import { Settings, Save, X } from 'lucide-react';
import { MasterData } from '../services/masterDataService';
import { t } from '../i18n';

export interface RegistrationSettings {
    tracker_id?: string;
    assigned_to_id?: string;
    status_id?: string;
    priority_id?: string;
    category_id?: string;
    create_root_issue?: boolean;
}

interface RegistrationSettingsDialogProps {
    open: boolean;
    masterData: MasterData | null;
    currentSettings: RegistrationSettings;
    onClose: () => void;
    onSave: (settings: RegistrationSettings) => void;
}

const RegistrationSettingsDialog: React.FC<RegistrationSettingsDialogProps> = ({
    open,
    masterData,
    currentSettings,
    onClose,
    onSave,
}) => {
    const [settings, setSettings] = useState<RegistrationSettings>(currentSettings);

    useEffect(() => {
        if (open) {
            setSettings(currentSettings);
        }
    }, [open, currentSettings]);

    if (!open) return null;

    const handleChange = (key: keyof RegistrationSettings, value: any) => {
        setSettings((prev) => ({
            ...prev,
            [key]: value === '' ? undefined : value,
        }));
    };

    const handleSave = () => {
        onSave(settings);
        onClose();
    };

    if (!masterData) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                    <p className="text-center text-slate-500">
                        {t('redmine_create_tasks.registration.loading_failed', 'Loading data or failed to load.')}
                    </p>
                    <div className="mt-4 flex justify-center">
                        <button onClick={onClose} className="rounded-full bg-slate-200 px-6 py-2 text-sm font-medium text-slate-600 hover:bg-slate-300">
                            {t('redmine_create_tasks.registration.close', 'Close')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Settings size={20} className="text-slate-600" />
                        <h2 className="text-lg font-bold text-slate-800">
                            {t('redmine_create_tasks.registration.title', 'Issue Registration Settings')}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none" aria-label={t('redmine_create_tasks.registration.close', 'Close')}>
                        ×
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">
                            {t('redmine_create_tasks.registration.description_line1', 'Configure default values for issue creation.')}
                            <br />
                            {t('redmine_create_tasks.registration.description_line2', 'These values are used when not specified.')}
                        </p>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="create_root_issue"
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                checked={settings.create_root_issue || false}
                                onChange={(e) => handleChange('create_root_issue', e.target.checked)}
                            />
                            <label htmlFor="create_root_issue" className="text-sm font-semibold text-slate-700">
                                {t('redmine_create_tasks.registration.create_root_issue', 'Register final deliverable as parent ticket')}
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                {t('redmine_create_tasks.registration.tracker', 'Tracker')}
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={settings.tracker_id || ''}
                                onChange={(e) => handleChange('tracker_id', e.target.value)}
                            >
                                <option value="">{t('redmine_create_tasks.registration.tracker_default', '(Project default)')}</option>
                                {masterData.trackers.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                {t('redmine_create_tasks.registration.assignee', 'Assignee')}
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={settings.assigned_to_id || ''}
                                onChange={(e) => handleChange('assigned_to_id', e.target.value)}
                            >
                                <option value="">{t('redmine_create_tasks.registration.assignee_self', '(Me)')}</option>
                                {masterData.users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                {t('redmine_create_tasks.registration.priority', 'Priority')}
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={settings.priority_id || ''}
                                onChange={(e) => handleChange('priority_id', e.target.value)}
                            >
                                <option value="">{t('redmine_create_tasks.registration.priority_default', '(Default: Normal)')}</option>
                                {masterData.priorities.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                {t('redmine_create_tasks.registration.status', 'Status')}
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={settings.status_id || ''}
                                onChange={(e) => handleChange('status_id', e.target.value)}
                            >
                                <option value="">{t('redmine_create_tasks.registration.status_default', '(Default: New)')}</option>
                                {masterData.issue_statuses.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {masterData.categories.length > 0 && (
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    {t('redmine_create_tasks.registration.category', 'Category')}
                                </label>
                                <select
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={settings.category_id || ''}
                                    onChange={(e) => handleChange('category_id', e.target.value)}
                                >
                                    <option value="">{t('redmine_create_tasks.registration.category_none', '(None)')}</option>
                                    {masterData.categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 flex-shrink-0 bg-slate-50/50 rounded-b-2xl">
                    <button
                        className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-white transition-colors"
                        onClick={onClose}
                    >
                        {t('redmine_create_tasks.registration.cancel', 'Cancel')}
                    </button>
                    <button
                        className="flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
                        onClick={handleSave}
                    >
                        <Save size={16} />
                        {t('redmine_create_tasks.registration.save', 'Save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RegistrationSettingsDialog;
