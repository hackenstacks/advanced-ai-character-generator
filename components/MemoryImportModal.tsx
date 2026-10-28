import React from 'react';
import { ChatSession } from '../types';

interface MemoryImportModalProps {
  allSessions: ChatSession[];
  currentSessionId: string;
  onClose: () => void;
  onImport: (fromSessionId: string) => void;
}

export const MemoryImportModal: React.FC<MemoryImportModalProps> = ({ allSessions, currentSessionId, onClose, onImport }) => {
  const otherSessions = allSessions.filter(s => s.id !== currentSessionId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background-primary rounded-lg shadow-xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-border-neutral flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-text-primary">Import Memory</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors text-2xl font-bold leading-none p-1">&times;</button>
        </header>
        
        <div className="p-6">
            <p className="text-text-secondary mb-4">Select a chat session to import memories from. Any characters present in both chats will have their memories from the selected session appended to their current memory.</p>
            
            <div className="max-h-80 overflow-y-auto border border-border-neutral rounded-md p-2 space-y-2">
                {otherSessions.length === 0 ? (
                    <p className="text-text-secondary text-center p-4">No other chat sessions available to import from.</p>
                ) : (
                    otherSessions.map(session => (
                        <div 
                            key={session.id} 
                            onClick={() => onImport(session.id)}
                            className="p-3 rounded-md cursor-pointer hover:bg-background-tertiary transition-colors"
                        >
                            <h3 className="font-semibold text-text-primary">{session.name}</h3>
                            <p className="text-sm text-text-secondary">
                                {session.messages.length} messages
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>

        <footer className="p-4 border-t border-border-neutral flex justify-end">
            <button onClick={onClose} className="py-2 px-4 rounded-md text-text-primary bg-background-tertiary hover:bg-opacity-80">Cancel</button>
        </footer>
      </div>
    </div>
  );
};