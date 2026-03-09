import React from 'react';
import { useAppState } from '../../store';

export function StatusBar() {
  const { documents, health } = useAppState();
  const indexingDoc = documents.find(d => d.status === 'indexing');
  const allOk = Object.values(health).every(v => v === 'ok');

  return (
    <footer
      className="flex items-center justify-between px-4"
      style={{
        gridArea: 'footer',
        height: 32,
        background: 'var(--bg-s1)',
        borderTop: '1px solid var(--border-main)',
        fontSize: 12,
        color: 'var(--text-4)',
      }}
    >
      <div>
        {indexingDoc && (
          <span style={{ color: 'var(--yellow)' }}>
            正在索引 {indexingDoc.filename}... {indexingDoc.progress ?? 0}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span>v1.0.0</span>
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: allOk ? 'var(--green)' : 'var(--red)' }} />
      </div>
    </footer>
  );
}