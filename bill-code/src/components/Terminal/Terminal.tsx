import { useState, useRef, useEffect } from 'react';
import { TerminalSquare, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import './Terminal.css';

interface TerminalProps {
  output: string[];
  onExecuteCommand: (command: string) => void;
  onClear: () => void;
}

export default function Terminal({ output, onExecuteCommand, onClear }: TerminalProps) {
  const [command, setCommand] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      onExecuteCommand(command.trim());
      setCommand('');
    }
  };

  const quickCommands = [
    { label: 'Limpar', cmd: 'cls' },
    { label: 'Dir', cmd: 'dir' },
    { label: 'PWD', cmd: 'cd' },
    { label: 'Node', cmd: 'node --version' },
    { label: 'Python', cmd: 'python --version' },
  ];

  return (
    <div className={`terminal-container ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="terminal-header">
        <div className="terminal-title">
          <TerminalSquare size={14} className="terminal-icon" />
          <span>Terminal</span>
        </div>
        <div className="terminal-actions">
          <button
            className="icon-btn"
            onClick={onClear}
            title="Limpar terminal"
          >
            <Trash2 size={14} />
          </button>
          <button
            className="icon-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Recolher' : 'Expandir'}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          <div className="terminal-output" ref={outputRef}>
            {output.length === 0 ? (
              <div className="terminal-empty">
                <p>Digite um comando abaixo para executar</p>
                <div className="quick-commands">
                  {quickCommands.map((qc) => (
                    <button
                      key={qc.label}
                      className="quick-cmd-btn"
                      onClick={() => onExecuteCommand(qc.cmd)}
                    >
                      {qc.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              output.map((line, index) => (
                <div
                  key={index}
                  className={`terminal-line ${line.startsWith('$') ? 'command' : ''} ${line.startsWith('Erro') ? 'error' : ''}`}
                >
                  {line}
                </div>
              ))
            )}
          </div>

          <form className="terminal-input-form" onSubmit={handleSubmit}>
            <span className="prompt-symbol">{'>'}</span>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Digite um comando..."
              className="terminal-input"
              autoFocus
            />
          </form>
        </>
      )}
    </div>
  );
}
