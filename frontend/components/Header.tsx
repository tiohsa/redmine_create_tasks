
import React, { useState, useRef, useEffect } from 'react';
import { BrainCircuit } from 'lucide-react';
import { t } from '../i18n';

interface HeaderProps {
  title: string;
  onUpdateTitle: (newTitle: string) => void;
}

const Header: React.FC<HeaderProps> = ({ title, onUpdateTitle }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleFinishEdit = () => {
    setIsEditing(false);
    if (editValue.trim()) {
      onUpdateTitle(editValue.trim());
    } else {
      setEditValue(title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(title);
    }
  };

  return (
    <header className="min-h-[56px] bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 shrink-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-slate-700 p-2 rounded-lg">
          <BrainCircuit className="text-white" size={20} />
        </div>
        <div className="min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              className="text-lg font-bold bg-white border-b border-slate-300 outline-none px-1 min-w-[160px]"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleFinishEdit}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <h1
              className="text-lg font-bold text-slate-800 cursor-pointer hover:bg-slate-50 px-1 rounded transition-colors select-none truncate"
              onDoubleClick={() => setIsEditing(true)}
              title={t('create_tasks.header.edit_title', 'Double-click to edit')}
            >
              {title}
            </h1>
          )}
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider leading-none ml-1">
            {t('create_tasks.header.subtitle', 'Redmine Plugin')}
          </p>
        </div>
      </div>

    </header>
  );
};

export default Header;
