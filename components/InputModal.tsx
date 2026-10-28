import React, { useState } from 'react';

interface InputModalProps {
  title: string;
  label: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  placeholder?: string;
  defaultValue?: string;
}

export const InputModal: React.FC<InputModalProps> = ({ 
  title, 
  label, 
  onConfirm, 
  onCancel, 
  placeholder = '',
  defaultValue = ''
}) => {
  const [inputValue, setInputValue] = useState<string>(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onConfirm(inputValue.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-background-secondary rounded-lg shadow-xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="p-4 flex items-center space-x-3 border-b border-border-neutral">
          <h2 className="text-xl font-bold text-text-primary">{title}</h2>
        </header>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-text-secondary">{label}</label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 bg-background-tertiary border border-border-neutral rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
              autoFocus
            />
          </div>
        </form>
        <footer className="p-4 bg-background-tertiary/50 flex justify-end space-x-3 rounded-b-lg">
            <button 
              type="button" 
              onClick={onCancel} 
              className="py-2 px-4 rounded-md text-text-primary bg-background-tertiary hover:bg-opacity-80 font-medium"
            >
                Cancel
            </button>
            <button 
              type="button" 
              onClick={handleSubmit} 
              disabled={!inputValue.trim()}
              className="py-2 px-4 rounded-md text-white bg-accent-blue hover:opacity-90 font-medium disabled:opacity-50"
            >
                Confirm
            </button>
        </footer>
      </div>
    </div>
  );
};