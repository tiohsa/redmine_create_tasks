import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Page } from '../types';
import { Plus, X, FileText } from 'lucide-react';
import { t } from '../i18n';

interface Props {
    pages: Page[];
    currentPageIndex: number;
    onSwitchPage: (index: number) => void;
    onAddPage: () => void;
    onDeletePage: (index: number) => void;
    onRenamePageTitle: (index: number, newTitle: string) => void;
}

const PageTabBar: React.FC<Props> = ({
    pages,
    currentPageIndex,
    onSwitchPage,
    onAddPage,
    onDeletePage,
    onRenamePageTitle
}) => {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingIndex !== null && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingIndex]);

    const handleDoubleClick = useCallback((index: number) => {
        setEditingIndex(index);
        setEditingTitle(pages[index].title);
    }, [pages]);

    const handleBlur = useCallback(() => {
        if (editingIndex !== null && editingTitle.trim()) {
            onRenamePageTitle(editingIndex, editingTitle.trim());
        }
        setEditingIndex(null);
        setEditingTitle('');
    }, [editingIndex, editingTitle, onRenamePageTitle]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBlur();
        } else if (e.key === 'Escape') {
            setEditingIndex(null);
            setEditingTitle('');
        }
    }, [handleBlur]);

    const handleDelete = useCallback((e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        if (pages.length <= 1) {
            alert(t('create_tasks.pages.cannot_delete_last', 'Cannot delete the last page'));
            return;
        }
        if (confirm(t('create_tasks.pages.delete_confirm', 'Delete this page?'))) {
            onDeletePage(index);
        }
    }, [pages.length, onDeletePage]);

    return (
        <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-slate-200 px-2 py-1.5 pointer-events-auto max-w-[calc(100%-220px)] overflow-x-auto">
            {pages.map((page, index) => (
                <div
                    key={page.id}
                    className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all text-sm font-medium whitespace-nowrap ${index === currentPageIndex
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    onClick={() => onSwitchPage(index)}
                    onDoubleClick={() => handleDoubleClick(index)}
                >
                    <FileText size={14} className={index === currentPageIndex ? 'text-white/80' : 'text-slate-400'} />

                    {editingIndex === index ? (
                        <input
                            ref={inputRef}
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            className="w-24 px-1 py-0.5 text-sm text-slate-900 bg-white rounded border border-slate-300 outline-none"
                        />
                    ) : (
                        <span className="max-w-[120px] truncate">{page.title}</span>
                    )}

                    {pages.length > 1 && (
                        <button
                            onClick={(e) => handleDelete(e, index)}
                            className={`ml-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10 ${index === currentPageIndex ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            title={t('create_tasks.pages.delete_page', 'Delete Page')}
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            ))}

            <button
                onClick={onAddPage}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-sm"
                title={t('create_tasks.pages.add_page', 'Add Page')}
            >
                <Plus size={16} />
            </button>
        </div>
    );
};

export default PageTabBar;
