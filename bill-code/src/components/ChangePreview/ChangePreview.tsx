import React from 'react';
import { Check, X, FileText, Trash2, FileEdit, FolderInput, Terminal } from 'lucide-react';
import { PendingChange } from '../../App';

interface ChangePreviewProps {
  changes: PendingChange[];
  onAccept: (changeId: string) => void;
  onReject: (changeId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onClose: () => void;
}

export default function ChangePreview({
  changes,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  onClose
}: ChangePreviewProps) {
  if (changes.length === 0) return null;

  const getChangeIcon = (type: PendingChange['type']) => {
    switch (type) {
      case 'create': return <FileText size={16} />;
      case 'edit': return <FileEdit size={16} />;
      case 'delete': return <Trash2 size={16} />;
      case 'rename':
      case 'move': return <FolderInput size={16} />;
      case 'command': return <Terminal size={16} />;
    }
  };

  const getChangeColor = (type: PendingChange['type']) => {
    switch (type) {
      case 'create': return '#4ade80';
      case 'edit': return '#60a5fa';
      case 'delete': return '#f87171';
      case 'rename':
      case 'move': return '#fbbf24';
      case 'command': return '#a78bfa';
    }
  };

  const renderDiff = (change: PendingChange) => {
    if (change.type === 'command') {
      return (
        <div style={{ 
          padding: '12px', 
          background: '#1e1e1e', 
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#d4d4d4'
        }}>
          <div style={{ color: '#a78bfa', marginBottom: '4px' }}>$ {change.command}</div>
          {change.reason && <div style={{ color: '#6b7280', fontSize: '11px' }}>💡 {change.reason}</div>}
        </div>
      );
    }

    if (change.type === 'delete') {
      return (
        <div style={{ padding: '12px', background: '#2d1515', borderRadius: '4px', color: '#f87171' }}>
          <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            🗑️ Arquivo será deletado
          </div>
          {change.reason && <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '8px' }}>💡 {change.reason}</div>}
        </div>
      );
    }

    if (change.type === 'rename' || change.type === 'move') {
      return (
        <div style={{ padding: '12px', background: '#2d2415', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#fbbf24' }}>
            📁 {change.filePath}
          </div>
          <div style={{ margin: '8px 0', color: '#9ca3af' }}>↓</div>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#4ade80' }}>
            📁 {change.newPath}
          </div>
          {change.reason && <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '8px' }}>💡 {change.reason}</div>}
        </div>
      );
    }

    if (change.type === 'create') {
      const lines = (change.content || '').split('\n');
      const preview = lines.slice(0, 15).join('\n');
      const hasMore = lines.length > 15;

      return (
        <div style={{ padding: '12px', background: '#1e1e1e', borderRadius: '4px' }}>
          <div style={{ fontSize: '11px', color: '#4ade80', marginBottom: '8px' }}>
            ✨ Novo arquivo ({lines.length} linhas)
          </div>
          <pre style={{ 
            margin: 0, 
            fontSize: '11px', 
            lineHeight: '1.5',
            color: '#d4d4d4',
            maxHeight: '200px',
            overflow: 'auto',
            fontFamily: 'monospace'
          }}>
            {preview}
            {hasMore && <div style={{ color: '#6b7280', marginTop: '8px' }}>... +{lines.length - 15} linhas</div>}
          </pre>
          {change.reason && <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '8px' }}>💡 {change.reason}</div>}
        </div>
      );
    }

    if (change.type === 'edit') {
      const oldLines = (change.oldContent || '').split('\n');
      const newLines = (change.content || '').split('\n');
      
      return (
        <div style={{ padding: '12px', background: '#1e1e1e', borderRadius: '4px' }}>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>
            📝 Mudanças ({oldLines.length} → {newLines.length} linhas)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
            <div>
              <div style={{ color: '#f87171', marginBottom: '4px' }}>❌ Antes:</div>
              <pre style={{ 
                margin: 0, 
                padding: '8px',
                background: '#2d1515',
                borderRadius: '4px',
                maxHeight: '150px',
                overflow: 'auto',
                color: '#f87171',
                fontFamily: 'monospace',
                lineHeight: '1.5'
              }}>
                {oldLines.slice(0, 10).join('\n')}
                {oldLines.length > 10 && <div style={{ color: '#6b7280' }}>... +{oldLines.length - 10}</div>}
              </pre>
            </div>
            <div>
              <div style={{ color: '#4ade80', marginBottom: '4px' }}>✅ Depois:</div>
              <pre style={{ 
                margin: 0, 
                padding: '8px',
                background: '#1a2d1a',
                borderRadius: '4px',
                maxHeight: '150px',
                overflow: 'auto',
                color: '#4ade80',
                fontFamily: 'monospace',
                lineHeight: '1.5'
              }}>
                {newLines.slice(0, 10).join('\n')}
                {newLines.length > 10 && <div style={{ color: '#6b7280' }}>... +{newLines.length - 10}</div>}
              </pre>
            </div>
          </div>
          {change.reason && <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '8px' }}>💡 {change.reason}</div>}
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '500px',
      height: '100vh',
      background: '#1e1e1e',
      borderLeft: '1px solid #333',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '-4px 0 12px rgba(0,0,0,0.3)'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#252525'
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
            🔍 Review Changes
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
            {changes.length} mudanças pendentes
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Actions */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #333',
        display: 'flex',
        gap: '8px'
      }}>
        <button
          onClick={onAcceptAll}
          style={{
            flex: 1,
            padding: '8px 16px',
            background: '#16a34a',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Check size={16} />
          Accept All
        </button>
        <button
          onClick={onRejectAll}
          style={{
            flex: 1,
            padding: '8px 16px',
            background: '#dc2626',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <X size={16} />
          Reject All
        </button>
      </div>

      {/* Changes List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px'
      }}>
        {changes.map((change) => (
          <div
            key={change.id}
            style={{
              marginBottom: '16px',
              background: '#252525',
              borderRadius: '8px',
              border: `1px solid ${getChangeColor(change.type)}33`,
              overflow: 'hidden'
            }}
          >
            {/* Change Header */}
            <div style={{
              padding: '12px 16px',
              background: `${getChangeColor(change.type)}15`,
              borderBottom: `1px solid ${getChangeColor(change.type)}33`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{ color: getChangeColor(change.type) }}>
                {getChangeIcon(change.type)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '13px', 
                  fontWeight: 500, 
                  color: '#fff',
                  fontFamily: 'monospace'
                }}>
                  {change.filePath.split('\\').pop() || change.filePath.split('/').pop()}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                  {change.type.toUpperCase()} · {new Date(change.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Change Content */}
            <div style={{ padding: '16px' }}>
              {renderDiff(change)}
            </div>

            {/* Change Actions */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid #333',
              display: 'flex',
              gap: '8px'
            }}>
              <button
                onClick={() => onAccept(change.id)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  background: '#16a34a',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <Check size={14} />
                Accept
              </button>
              <button
                onClick={() => onReject(change.id)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  background: '#dc2626',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <X size={14} />
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
