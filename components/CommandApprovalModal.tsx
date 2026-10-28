
import React, { useState } from 'react';
import { Character } from '../types';
import { TerminalIcon } from './icons/TerminalIcon';

export type ApprovalScope = 'once' | 'session' | 'always_command' | 'always_character';
export type ApprovalDecision = 'approve' | 'deny';

export interface CommandApprovalRequest {
    id: string;
    character: Character;
    command: string;
    reason?: string;
    timestamp: number;
}

export interface ApprovalRule {
    type: 'command' | 'character';
    value: string; // command string or character ID
    decision: ApprovalDecision;
    scope: 'session' | 'permanent';
    createdAt: number;
}

interface CommandApprovalModalProps {
    request: CommandApprovalRequest;
    onDecision: (decision: ApprovalDecision, scope: ApprovalScope) => void;
    onCancel: () => void;
}

export const CommandApprovalModal: React.FC<CommandApprovalModalProps> = ({
    request,
    onDecision,
    onCancel
}) => {
    const [selectedScope, setSelectedScope] = useState<ApprovalScope>('once');

    const handleApprove = () => {
        onDecision('approve', selectedScope);
    };

    const handleDeny = () => {
        onDecision('deny', selectedScope);
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-amber-500/50 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-900/50 to-red-900/50 p-4 border-b border-amber-500/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                            <TerminalIcon className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-amber-100">Terminal Access Request</h2>
                            <p className="text-sm text-amber-200/70">A character wants to execute a command</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Character info */}
                    <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                        {request.character.avatarUrl ? (
                            <img
                                src={request.character.avatarUrl}
                                alt={request.character.name}
                                className="w-12 h-12 rounded-full object-cover border-2 border-amber-500/50"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg">
                                {request.character.name.charAt(0)}
                            </div>
                        )}
                        <div>
                            <p className="font-semibold text-white">{request.character.name}</p>
                            <p className="text-sm text-gray-400">requests terminal access</p>
                        </div>
                    </div>

                    {/* Command preview */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Command to execute:</label>
                        <div className="bg-black/50 border border-gray-700 rounded-lg p-3 font-mono text-sm">
                            <span className="text-green-400">$</span>{' '}
                            <span className="text-amber-300">{request.command}</span>
                        </div>
                    </div>

                    {/* Reason if provided */}
                    {request.reason && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Reason:</label>
                            <p className="text-sm text-gray-400 italic">"{request.reason}"</p>
                        </div>
                    )}

                    {/* Scope selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Remember this decision:</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setSelectedScope('once')}
                                className={`p-2 rounded-lg border text-sm transition-all ${
                                    selectedScope === 'once'
                                        ? 'border-amber-500 bg-amber-500/20 text-amber-100'
                                        : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                                }`}
                            >
                                Just this once
                            </button>
                            <button
                                onClick={() => setSelectedScope('session')}
                                className={`p-2 rounded-lg border text-sm transition-all ${
                                    selectedScope === 'session'
                                        ? 'border-amber-500 bg-amber-500/20 text-amber-100'
                                        : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                                }`}
                            >
                                This session
                            </button>
                            <button
                                onClick={() => setSelectedScope('always_command')}
                                className={`p-2 rounded-lg border text-sm transition-all ${
                                    selectedScope === 'always_command'
                                        ? 'border-amber-500 bg-amber-500/20 text-amber-100'
                                        : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                                }`}
                            >
                                Always this command
                            </button>
                            <button
                                onClick={() => setSelectedScope('always_character')}
                                className={`p-2 rounded-lg border text-sm transition-all ${
                                    selectedScope === 'always_character'
                                        ? 'border-amber-500 bg-amber-500/20 text-amber-100'
                                        : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                                }`}
                            >
                                Trust {request.character.name.split(' ')[0]}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-gray-800/30 border-t border-gray-700 flex gap-3">
                    <button
                        onClick={handleDeny}
                        className="flex-1 py-2 px-4 bg-red-900/50 hover:bg-red-800/50 border border-red-500/50 rounded-lg text-red-100 font-medium transition-colors"
                    >
                        ❌ Deny
                    </button>
                    <button
                        onClick={onCancel}
                        className="py-2 px-4 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600 rounded-lg text-gray-300 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApprove}
                        className="flex-1 py-2 px-4 bg-green-900/50 hover:bg-green-800/50 border border-green-500/50 rounded-lg text-green-100 font-medium transition-colors"
                    >
                        ✅ Approve
                    </button>
                </div>
            </div>
        </div>
    );
};

// Permission manager - tracks approved/denied commands
export class PermissionManager {
    private sessionRules: ApprovalRule[] = [];
    private permanentRules: ApprovalRule[] = [];

    constructor() {
        // Load permanent rules from localStorage
        try {
            const stored = localStorage.getItem('nexus_terminal_permissions');
            if (stored) {
                this.permanentRules = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to load terminal permissions:', e);
        }
    }

    private savePermRules() {
        try {
            localStorage.setItem('nexus_terminal_permissions', JSON.stringify(this.permanentRules));
        } catch (e) {
            console.warn('Failed to save terminal permissions:', e);
        }
    }

    addRule(rule: ApprovalRule) {
        if (rule.scope === 'session') {
            this.sessionRules.push(rule);
        } else {
            this.permanentRules.push(rule);
            this.savePermRules();
        }
    }

    checkPermission(characterId: string, command: string): ApprovalDecision | null {
        // Check character-level trust first (permanent, then session)
        const charPermRule = [...this.permanentRules, ...this.sessionRules].find(
            r => r.type === 'character' && r.value === characterId
        );
        if (charPermRule) return charPermRule.decision;

        // Check command-level rules
        const cmdPermRule = [...this.permanentRules, ...this.sessionRules].find(
            r => r.type === 'command' && r.value === command
        );
        if (cmdPermRule) return cmdPermRule.decision;

        // No rule found
        return null;
    }

    clearSessionRules() {
        this.sessionRules = [];
    }

    clearAllRules() {
        this.sessionRules = [];
        this.permanentRules = [];
        localStorage.removeItem('nexus_terminal_permissions');
    }

    getRules(): { session: ApprovalRule[], permanent: ApprovalRule[] } {
        return {
            session: [...this.sessionRules],
            permanent: [...this.permanentRules]
        };
    }
}

// Singleton instance
export const permissionManager = new PermissionManager();

// Helper to parse terminal commands from character responses
export const parseTerminalCommands = (text: string): { command: string, reason?: string }[] => {
    const commands: { command: string, reason?: string }[] = [];

    // Pattern 1: [TERMINAL: command] or [EXEC: command]
    const bracketPattern = /\[(TERMINAL|EXEC|CMD|RUN):\s*([^\]]+)\]/gi;
    let match;
    while ((match = bracketPattern.exec(text)) !== null) {
        commands.push({ command: match[2].trim() });
    }

    // Pattern 2: ```terminal\ncommand\n``` or ```bash\ncommand\n```
    const codeBlockPattern = /```(?:terminal|bash|sh|shell)\n([\s\S]*?)```/gi;
    while ((match = codeBlockPattern.exec(text)) !== null) {
        const cmd = match[1].trim();
        if (cmd && !cmd.includes('\n')) { // Single line commands only for safety
            commands.push({ command: cmd });
        }
    }

    // Pattern 3: /execute command or /run command
    const slashPattern = /\/(?:execute|run|exec|terminal)\s+(.+?)(?:\n|$)/gi;
    while ((match = slashPattern.exec(text)) !== null) {
        commands.push({ command: match[1].trim() });
    }

    return commands;
};
