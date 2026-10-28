
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TerminalIcon } from './icons/TerminalIcon';
import { FileSystemState } from '../types';
import { executeCommand, callAichat, callOllama, checkApiHealth, fetchUrl, webSearch, httpRequest, executeCode, listLanguages } from '../services/fileSystemService';

interface TerminalWindowProps {
  fileSystem: FileSystemState;
  onUpdateFileSystem: (newState: FileSystemState) => void;
  onClose: () => void;
}

// Constants for memory management
const MAX_TERMINAL_HISTORY = 50; // Limit terminal output history to prevent memory bloat

// LIVE mode connects to the NeXuS web-server PTY WebSocket (localhost-only, real shell).
const PTY_WS = (() => {
  if (typeof window === 'undefined') return '';
  const proxy = (import.meta as any).env?.VITE_NEXUS_WEB_PROXY || `${window.location.protocol}//${window.location.host}`;
  return proxy.replace(/^http/, 'ws') + '/api/nexus/studio/terminal';
})();

export const TerminalWindow: React.FC<TerminalWindowProps> = ({ fileSystem, onUpdateFileSystem, onClose }) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<{cmd: string, output: string}[]>([]);
  const [mode, setMode] = useState<'sim' | 'live'>('sim'); // SIM = sandboxed, LIVE = real xterm.js PTY
  const [liveStatus, setLiveStatus] = useState<'off' | 'connecting' | 'open' | 'error'>('off');

  const [position, setPosition] = useState({ x: 50, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<any>(null);

  // LIVE mode: lazy-load xterm.js from esm.sh (CSP-allowed) and bridge to the PTY WebSocket.
  useEffect(() => {
    if (mode !== 'live' || !xtermRef.current) return;
    let disposed = false;
    (async () => {
      try {
        setLiveStatus('connecting');
        const [{ Terminal }, { FitAddon }] = await Promise.all([
          import(/* @vite-ignore */ 'https://esm.sh/@xterm/xterm@5.5.0'),
          import(/* @vite-ignore */ 'https://esm.sh/@xterm/addon-fit@0.10.0'),
        ]);
        if (disposed) return;
        const term = new Terminal({
          fontFamily: 'monospace', fontSize: 13, cursorBlink: true,
          theme: { background: '#0a0a0f', foreground: '#00ff88', cursor: '#00e5ff' },
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(xtermRef.current!);
        fit.fit();
        termRef.current = term;

        const ws = new WebSocket(PTY_WS);
        wsRef.current = ws;
        ws.onopen = () => { setLiveStatus('open'); term.writeln('\x1b[36m⇅ TransWay LIVE — real shell (localhost)\x1b[0m'); };
        ws.onmessage = (e) => term.write(typeof e.data === 'string' ? e.data : new Uint8Array(e.data as ArrayBuffer));
        ws.onerror = () => { setLiveStatus('error'); term.writeln('\x1b[31m[PTY connection failed — is the web server running on :8443?]\x1b[0m'); };
        ws.onclose = () => setLiveStatus('off');
        term.onData((d: string) => ws.readyState === 1 && ws.send(d));
        const onResize = () => { try { fit.fit(); } catch {} };
        window.addEventListener('resize', onResize);
        (term as any)._nexusCleanup = () => window.removeEventListener('resize', onResize);
      } catch (err) {
        setLiveStatus('error');
      }
    })();
    return () => {
      disposed = true;
      try { termRef.current?._nexusCleanup?.(); } catch {}
      try { wsRef.current?.close(); } catch {}
      try { termRef.current?.dispose(); } catch {}
      wsRef.current = null; termRef.current = null;
    };
  }, [mode]);

  useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (windowRef.current && (e.target as HTMLElement).closest('.drag-handle')) {
        setIsDragging(true);
        const rect = windowRef.current.getBoundingClientRect();
        setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => { setIsDragging(false); }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const { output, newState } = executeCommand(fileSystem, input);

      // Handle special commands
      if (output === "__CLEAR__") {
          setHistory([]);
          setInput('');
          return;
      }

      // Helper to add history with size limit
      const addToHistory = (newEntry: {cmd: string, output: string}) => {
          setHistory(prev => {
              const updated = [...prev, newEntry];
              // Trim to max size to prevent memory bloat
              return updated.length > MAX_TERMINAL_HISTORY
                  ? updated.slice(-MAX_TERMINAL_HISTORY)
                  : updated;
          });
      };

      // Handle async AI commands
      if (output.startsWith("__ASYNC_AI__:")) {
          const message = output.replace("__ASYNC_AI__:", "");
          addToHistory({ cmd: input, output: "⏳ Querying AI..." });
          setInput('');
          setIsLoading(true);

          try {
              const aiResponse = await callAichat(message);
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: `🤖 AI Response:\n${aiResponse}`
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          } catch (error) {
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: `❌ Error: ${error}`
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          }

          setIsLoading(false);
          onUpdateFileSystem(newState);
          return;
      }

      // Handle Ollama async command
      if (output.startsWith("__ASYNC_OLLAMA__:")) {
          const parts = output.replace("__ASYNC_OLLAMA__:", "").split(":");
          const model = parts[0];
          const message = parts.slice(1).join(":");
          addToHistory({ cmd: input, output: `⏳ Querying Ollama (${model})...` });
          setInput('');
          setIsLoading(true);

          try {
              const aiResponse = await callOllama(message, model);
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: `🦙 Ollama [${model}]:\n${aiResponse}`
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          } catch (error) {
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: `❌ Ollama Error: ${error}`
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          }

          setIsLoading(false);
          onUpdateFileSystem(newState);
          return;
      }

      // Handle API status check
      if (output.startsWith("__ASYNC_API_STATUS__:")) {
          const target = output.replace("__ASYNC_API_STATUS__:", "");
          addToHistory({ cmd: input, output: "⏳ Checking API connections..." });
          setInput('');
          setIsLoading(true);

          try {
              const health = await checkApiHealth();
              let statusOutput = `🔌 API Status Dashboard\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

              for (const [key, info] of Object.entries(health)) {
                  if (target !== 'all' && target !== key) continue;
                  statusOutput += `\n${key.toUpperCase()}\n`;
                  statusOutput += `  Status: ${info.status}\n`;
                  if (info.latency) statusOutput += `  Latency: ${info.latency}ms\n`;
                  if (info.models && info.models.length > 0) {
                      statusOutput += `  Models: ${info.models.join(', ')}\n`;
                  }
              }

              statusOutput += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { cmd: input, output: statusOutput };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          } catch (error) {
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: `❌ Error checking APIs: ${error}`
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          }

          setIsLoading(false);
          onUpdateFileSystem(newState);
          return;
      }

      // Handle async fetch (curl/wget)
      if (output.startsWith("__ASYNC_FETCH__:")) {
          const url = output.replace("__ASYNC_FETCH__:", "");
          addToHistory({ cmd: input, output: `⏳ Fetching ${url}...` });
          setInput('');
          setIsLoading(true);

          try {
              const content = await fetchUrl(url);
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: `🌐 ${url}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${content}`
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          } catch (error) {
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: `❌ Fetch Error: ${error}`
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          }

          setIsLoading(false);
          onUpdateFileSystem(newState);
          return;
      }

      // Handle async search
      if (output.startsWith("__ASYNC_SEARCH__:")) {
          const query = output.replace("__ASYNC_SEARCH__:", "");
          addToHistory({ cmd: input, output: `🔍 Searching for "${query}"...` });
          setInput('');
          setIsLoading(true);

          try {
              const results = await webSearch(query);
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: results
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          } catch (error) {
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: `❌ Search Error: ${error}`
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          }

          setIsLoading(false);
          onUpdateFileSystem(newState);
          return;
      }

      // Handle async HTTP request
      if (output.startsWith("__ASYNC_HTTP__:")) {
          const parts = output.replace("__ASYNC_HTTP__:", "").split(":");
          const method = parts[0];
          const url = parts[1];
          const body = parts.slice(2).join(":");
          addToHistory({ cmd: input, output: `⏳ ${method} ${url}...` });
          setInput('');
          setIsLoading(true);

          try {
              const response = await httpRequest(method, url, body || undefined);
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: `🌐 ${method} ${url}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${response}`
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          } catch (error) {
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: `❌ HTTP Error: ${error}`
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          }

          setIsLoading(false);
          onUpdateFileSystem(newState);
          return;
      }

      // Handle async code execution
      if (output.startsWith("__ASYNC_CODE__:")) {
          const parts = output.replace("__ASYNC_CODE__:", "").split(":");
          const language = parts[0];
          const code = parts.slice(1).join(":");

          addToHistory({ cmd: input, output: `⏳ Executing ${language} code...` });
          setInput('');
          setIsLoading(true);

          try {
              const result = await executeCode(language, code);
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: `╭─────────────  CODE  ─────────────╮
│ ${language.toUpperCase().padEnd(35)} │
╰──────────────────────────────────╯
${code}

${result}`
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          } catch (error) {
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: `❌ Execution Error: ${error}`
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          }

          setIsLoading(false);
          onUpdateFileSystem(newState);
          return;
      }

      // Handle async languages list
      if (output === "__ASYNC_LANGUAGES__") {
          addToHistory({ cmd: input, output: "⏳ Fetching available languages..." });
          setInput('');
          setIsLoading(true);

          try {
              const languages = await listLanguages();
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: languages
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          } catch (error) {
              setHistory(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                      cmd: input,
                      output: `❌ Error: ${error}`
                  };
                  return updated.slice(-MAX_TERMINAL_HISTORY);
              });
          }

          setIsLoading(false);
          onUpdateFileSystem(newState);
          return;
      }

      // Regular command output - add to history with limit
      addToHistory({ cmd: input, output });
      onUpdateFileSystem(newState);
      setInput('');
  };

  const statusDot = { off: 'bg-gray-500', connecting: 'bg-yellow-400 animate-pulse', open: 'bg-green-400', error: 'bg-red-500' }[liveStatus];

  return (
    <div
      ref={windowRef}
      className="fixed z-40 w-full max-w-2xl font-mono rounded-lg shadow-2xl flex flex-col border border-cyan-500/40"
      style={{
        top: `${position.y}px`, left: `${position.x}px`, height: '420px', resize: 'both', overflow: 'hidden', minWidth: '380px', minHeight: '260px',
        background: 'linear-gradient(180deg, rgba(10,10,15,0.97) 0%, rgba(6,10,14,0.97) 100%)',
        boxShadow: '0 0 30px rgba(0,229,255,0.15), inset 0 0 60px rgba(0,255,136,0.03)',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* CRT scanline overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 rounded-lg" style={{
        background: 'repeating-linear-gradient(0deg, rgba(0,255,136,0.03) 0px, rgba(0,255,136,0.03) 1px, transparent 1px, transparent 3px)',
      }}/>

      <header className="drag-handle p-2 border-b border-cyan-500/30 flex justify-between items-center cursor-move rounded-t-lg" style={{ background: 'linear-gradient(90deg, #0a0f14, #0e1620)' }}>
        <div className="flex items-center space-x-2 min-w-0">
            <TerminalIcon className="w-5 h-5 text-cyan-400" style={{ filter: 'drop-shadow(0 0 4px #00e5ff)' }}/>
            <span className="text-sm font-bold text-cyan-100 truncate" style={{ textShadow: '0 0 6px rgba(0,229,255,0.4)' }}>
              {mode === 'live' ? 'nexus@live' : 'restricted_user@nexus'}: {mode === 'live' ? '~' : fileSystem.currentPath}
            </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
            {/* SIM ⇄ LIVE toggle */}
            <button
              onClick={() => setMode(m => m === 'sim' ? 'live' : 'sim')}
              title={mode === 'sim' ? 'Switch to LIVE real shell (xterm.js)' : 'Switch to SIM sandbox'}
              className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded border transition-colors"
              style={mode === 'live'
                ? { borderColor: '#00ff88', color: '#00ff88', background: 'rgba(0,255,136,0.08)' }
                : { borderColor: '#00e5ff55', color: '#7dd3fc', background: 'rgba(0,229,255,0.05)' }}
            >
              <span className={`w-2 h-2 rounded-full ${mode === 'live' ? statusDot : 'bg-cyan-400'}`}/>
              {mode === 'live' ? 'LIVE' : 'SIM'}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-red-400 font-bold px-2">&times;</button>
        </div>
      </header>

      {mode === 'live' ? (
        <div className="flex-1 relative z-20 p-1" style={{ background: '#0a0a0f' }}>
          <div ref={xtermRef} className="w-full h-full"/>
          {liveStatus === 'error' && (
            <div className="absolute bottom-2 left-2 text-xs text-red-400">PTY unreachable — start web server on :8443</div>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 p-4 overflow-y-auto space-y-2 relative z-20">
            <div className="text-xs text-cyan-500/60 mb-4" style={{ textShadow: '0 0 6px rgba(0,229,255,0.3)' }}>
              NeXuS OS v2.0 · Sandbox · type <span className="text-cyan-300">help</span> · flip <span className="text-green-400">LIVE</span> for a real shell
            </div>
            {history.map((entry, i) => (
                <div key={i} className="space-y-1">
                    <div className="flex">
                        <span className="text-cyan-400 mr-2">❯</span>
                        <span className="text-green-300">{entry.cmd}</span>
                    </div>
                    {entry.output && (
                        <div className="whitespace-pre-wrap text-gray-300 pl-4 border-l-2 border-cyan-500/30">
                            {entry.output}
                        </div>
                    )}
                </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-2 border-t border-cyan-500/30 rounded-b-lg flex items-center relative z-20" style={{ background: 'linear-gradient(90deg, #0a0f14, #0e1620)' }}>
              <span className="text-cyan-400 mr-2" style={{ textShadow: '0 0 6px #00e5ff' }}>❯</span>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-green-300 placeholder-green-500/30"
                style={{ textShadow: '0 0 4px rgba(0,255,136,0.3)' }}
                placeholder={isLoading ? 'working…' : 'enter command…'}
                autoFocus
                disabled={isLoading}
              />
          </form>
        </>
      )}
    </div>
  );
};
