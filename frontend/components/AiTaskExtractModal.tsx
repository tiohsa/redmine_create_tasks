
import React, { useState, useEffect } from 'react';
import { RotateCcw, Save, Settings, CheckSquare, Square } from 'lucide-react';
import { t } from '../i18n';

type AiTaskExtractModalProps = {
  open: boolean;
  provider: 'gemini' | 'azure-openai';
  prompt: string;
  tasks: string[];
  loading: boolean;
  error: string | null;
  onProviderChange: (value: 'gemini' | 'azure-openai') => void;
  onPromptChange: (value: string) => void;
  onConfirm: (selectedTasks: string[]) => void;
  onGenerate: () => void;
  onSaveSettings: () => void;
  onLoadDefaults: () => void;
  onClose: () => void;
};

const AiTaskExtractModal: React.FC<AiTaskExtractModalProps> = ({
  open,
  provider,
  prompt,
  tasks,
  loading,
  error,
  onProviderChange,
  onPromptChange,
  onConfirm,
  onGenerate,
  onSaveSettings,
  onLoadDefaults,
  onClose
}) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // タスクが更新されたらデフォルトで全選択にする
  useEffect(() => {
    if (tasks.length > 0) {
      setSelectedIndices(new Set(tasks.map((_, i) => i)));
    } else {
      setSelectedIndices(new Set());
    }
  }, [tasks]);

  if (!open) return null;

  const toggleSelect = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedTasks = Array.from(selectedIndices)
      .sort((a, b) => a - b)
      .map(i => tasks[i]);
    onConfirm(selectedTasks);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-slate-600" />
            <h2 className="text-lg font-bold text-slate-800">{t('create_tasks.ai_modal.title', 'AI Task Extraction')}</h2>
          </div>
          <button
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            onClick={onClose}
            aria-label={t('create_tasks.ai_modal.close', 'Close')}
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 px-6 py-4">
          {/* 設定セクション */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                {t('create_tasks.ai_modal.provider', 'AI Provider')}
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                value={provider}
                onChange={(e) => onProviderChange(e.target.value as 'gemini' | 'azure-openai')}
              >
                <option value="gemini">Gemini</option>
                <option value="azure-openai">Azure Open AI</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onLoadDefaults}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-600 transition-colors font-medium"
                title={t('create_tasks.ai_modal.reset_prompt_title', 'Reset prompt to defaults')}
              >
                <RotateCcw size={14} />
                {t('create_tasks.ai_modal.reset_prompt', 'Load Defaults')}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              {t('create_tasks.ai_modal.prompt_label', 'Prompt')}
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none"
              rows={4}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
            />

            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-500 animate-pulse">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                {t('create_tasks.ai_modal.loading', 'Extracting...')}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {error}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700">
                  {t('create_tasks.ai_modal.results', 'Results')}
                </p>
                {tasks.length > 0 && (
                  <span className="text-xs text-slate-500">
                    {t('create_tasks.ai_modal.selected_count', '%{selected} / %{total} selected', {
                      selected: selectedIndices.size,
                      total: tasks.length
                    })}
                  </span>
                )}
              </div>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-4 min-h-[100px]">
                {tasks.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-sm text-slate-400">
                      {t('create_tasks.ai_modal.empty', 'No candidates. Enter a prompt and click Generate.')}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {tasks.map((task, index) => {
                      const isSelected = selectedIndices.has(index);
                      return (
                        <li key={`${task} -${index} `}>
                          <button
                            onClick={() => toggleSelect(index)}
                            className={`flex items - start gap - 3 w - full text - left p - 2 rounded - lg transition - colors ${isSelected ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-slate-100'} `}
                          >
                            <div className={`mt - 0.5 ${isSelected ? 'text-purple-600' : 'text-slate-300'} `}>
                              {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                            </div>
                            <span className={`text - sm break-words ${isSelected ? 'text-slate-800 font-medium' : 'text-slate-500'} `}>
                              {task}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 flex-shrink-0 bg-slate-50/50 rounded-b-2xl">
          <button
            onClick={onSaveSettings}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
            title={t('create_tasks.ai_modal.save_title', 'Save current provider and prompt')}
          >
            <Save size={16} />
            {t('create_tasks.ai_modal.save_settings', 'Save Settings')}
          </button>

          <div className="flex items-center gap-3">
            <button
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-white transition-colors"
              onClick={onClose}
            >
              {t('create_tasks.ai_modal.cancel', 'Cancel')}
            </button>
            <button
              className="rounded-full bg-slate-800 px-6 py-2 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-50 transition-all shadow-sm active:scale-95"
              onClick={onGenerate}
              disabled={loading}
            >
              {tasks.length === 0
                ? t('create_tasks.ai_modal.generate', 'Generate')
                : t('create_tasks.ai_modal.regenerate', 'Regenerate')}
            </button>
            <button
              className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm active:scale-95"
              onClick={handleConfirm}
              disabled={tasks.length === 0 || loading || selectedIndices.size === 0}
            >
              {t('create_tasks.ai_modal.apply', 'Apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiTaskExtractModal;
