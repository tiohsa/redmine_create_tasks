import React, { useState, useEffect } from 'react';
import { Settings, Save, X, Loader2 } from 'lucide-react';
import { MasterData } from '../services/masterDataService';
import { fetchIssue } from '../services/taskRegistrationService';
import { t } from '../i18n';

export interface RegistrationSettings {
    tracker_id?: string;
    assigned_to_id?: string;
    status_id?: string;
    priority_id?: string;
    category_id?: string;
    create_root_issue?: boolean;
    existing_root_issue_id?: string;
    relation_mode?: 'child' | 'dependency';
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
    const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [loadedIssue, setLoadedIssue] = useState<{ subject: string, isClosed: boolean } | null>(null);

    const handleLoadIssue = async (id: string) => {
        setLoadStatus('loading');
        setLoadedIssue(null);
        try {
            const issue = await fetchIssue(id);
            setLoadedIssue({
                subject: issue.subject,
                isClosed: masterData?.issue_statuses.find(s => s.id === issue.status_id)?.is_closed || false
            });
            setLoadStatus('success');
        } catch (e) {
            setLoadStatus('error');
        }
    };


    // Reset loop status when dialog opens or settings change (if needed)
    useEffect(() => {
        if (open) {
            setLoadStatus('idle');
            setLoadedIssue(null);
        }
    }, [open]);

    // Check if we need to load existing issue info if ID is already present
    useEffect(() => {
        if (open && settings.existing_root_issue_id && settings.existing_root_issue_id.match(/^\d+$/) && loadStatus === 'idle') {
            handleLoadIssue(settings.existing_root_issue_id);
        }
    }, [open, settings.existing_root_issue_id]); // Be careful not to loop

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

                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                {t('redmine_create_tasks.registration.root_handling', 'Final Deliverable (Root Task)')}
                            </label>

                            <div className="flex flex-col gap-3">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="root_handling"
                                        className="mt-1 h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={settings.create_root_issue !== false}
                                        onChange={() => handleChange('create_root_issue', true)}
                                    />
                                    <div>
                                        <div className="text-sm font-medium text-slate-700">
                                            {t('redmine_create_tasks.registration.create_new', 'Register as a new ticket')}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {t('redmine_create_tasks.registration.create_new_desc', 'Creates a new ticket for the root node.')}
                                        </div>
                                    </div>
                                </label>

                                <div className="flex items-start gap-3">
                                    <input
                                        type="radio"
                                        name="root_handling"
                                        className="mt-1 h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        checked={settings.create_root_issue === false}
                                        onChange={() => handleChange('create_root_issue', false)}
                                    />
                                    <div className="flex-1">
                                        <label
                                            className="text-sm font-medium text-slate-700 cursor-pointer block mb-2"
                                            onClick={() => handleChange('create_root_issue', false)}
                                        >
                                            {t('redmine_create_tasks.registration.use_existing', 'Link to existing ticket')}
                                        </label>

                                        {settings.create_root_issue === false && (
                                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder={t('redmine_create_tasks.registration.issue_id_placeholder', 'Issue ID')}
                                                        className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-400"
                                                        value={settings.existing_root_issue_id || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                                            handleChange('existing_root_issue_id', val);
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => settings.existing_root_issue_id && handleLoadIssue(settings.existing_root_issue_id)}
                                                        disabled={!settings.existing_root_issue_id || loadStatus === 'loading'}
                                                        className="flex items-center justify-center rounded-lg bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[4rem]"
                                                    >
                                                        {loadStatus === 'loading' ? <Loader2 className="animate-spin h-4 w-4" /> : t('redmine_create_tasks.registration.load', 'Load')}
                                                    </button>
                                                </div>

                                                {loadStatus === 'error' && (
                                                    <div className="text-xs text-red-600 flex items-center gap-1 font-medium bg-red-50 p-2 rounded-lg">
                                                        <X size={12} />
                                                        {t('redmine_create_tasks.registration.load_error', 'Details not found.')}
                                                    </div>
                                                )}

                                                {loadedIssue && (
                                                    <div className={`text-xs p-3 rounded-lg border flex flex-col gap-1 ${loadedIssue.isClosed ? 'bg-red-50 border-red-100 text-red-800' : 'bg-green-50 border-green-100 text-green-800'}`}>
                                                        <div className="font-bold flex items-center gap-2">
                                                            {loadedIssue.isClosed
                                                                ? <span className="flex h-2 w-2 rounded-full bg-red-500" />
                                                                : <span className="flex h-2 w-2 rounded-full bg-green-500" />
                                                            }
                                                            #{settings.existing_root_issue_id}
                                                        </div>
                                                        <div className="font-medium line-clamp-2 leading-relaxed opacity-90">
                                                            {loadedIssue.subject}
                                                        </div>
                                                        {loadedIssue.isClosed && (
                                                            <div className="mt-1 font-bold text-red-600 bg-white/50 px-2 py-1 rounded inline-self-start">
                                                                {t('redmine_create_tasks.registration.cannot_use_closed', 'Closed Ticket')}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                {t('redmine_create_tasks.registration.relation_mode_label', 'Relation Mode')}
                            </label>

                            <div className="flex flex-col gap-3">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="relation_mode"
                                        className="mt-1 h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={settings.relation_mode !== 'dependency'}
                                        onChange={() => handleChange('relation_mode', 'child')}
                                    />
                                    <div>
                                        <div className="text-sm font-medium text-slate-700">
                                            {t('redmine_create_tasks.registration.relation_mode_child', 'Register as child tickets')}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {t('redmine_create_tasks.registration.relation_mode_child_desc', 'Registers mind map hierarchy as Redmine parent-child tickets')}
                                        </div>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="relation_mode"
                                        className="mt-1 h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={settings.relation_mode === 'dependency'}
                                        onChange={() => handleChange('relation_mode', 'dependency')}
                                    />
                                    <div>
                                        <div className="text-sm font-medium text-slate-700">
                                            {t('redmine_create_tasks.registration.relation_mode_dependency', 'Register as dependencies')}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {t('redmine_create_tasks.registration.relation_mode_dependency_desc', 'Registers mind map hierarchy as Redmine precedes/follows relations')}
                                        </div>
                                    </div>
                                </label>
                            </div>
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
