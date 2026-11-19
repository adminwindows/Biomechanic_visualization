import { useRef, useState } from 'react';
import type { LabState } from './state';
import {
  MAX_WORKSPACE_BYTES, WorkspaceRestoreError, exportRawWorkspaceRecovery, exportWorkspace,
  flushWorkspaceEdits, parseWorkspaceBackup, restoreWorkspaceBackup, workspaceSummary,
  type WorkspaceBackup as BackupData,
} from './workspaceBackup';

function download(raw: string, filename: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function WorkspaceBackup({ state, onRestored, onNotice }: {
  state: LabState; onRestored: () => void; onNotice: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ raw: string; data: BackupData } | null>(null);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState<string | null>(null);
  function safely(action: () => void) {
    try { action(); setError(''); }
    catch (reason) {
      if (reason instanceof WorkspaceRestoreError) setRecovery(reason.recovery);
      const message = reason instanceof Error ? reason.message : 'The workspace operation failed.';
      setError(message); onNotice(message);
    }
  }
  async function read(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_WORKSPACE_BYTES) throw new Error('Choose a workspace file smaller than 5 MB.');
      const raw = await file.text(), data = parseWorkspaceBackup(raw);
      setPending({ raw, data }); setError(''); setRecovery(null);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'This workspace file could not be opened.';
      setError(message); onNotice(message); setPending(null);
    }
    if (input.current) input.current.value = '';
  }
  return <details className="workspace-drawer" id="workspace-backup">
    <summary><span>Whole workspace backup</span><span className="drawer-description">Comparisons, profiles, machines, drafts and saved notes</span></summary>
    <div className="drawer-body">
      <p className="small-note">Keep all workbenches in one portable file. Current comparison edits are included. Save a research-note draft first; the backup includes saved notebook entries. Files stay on your device.</p>
      <div className="reset-controls">
        <button onClick={() => safely(() => {
          flushWorkspaceEdits(); download(exportWorkspace(state), 'biomechanics-workspace.json');
          onNotice('Whole workspace exported, including your current comparison and saved work across the workbenches.');
        })}>Export workspace</button>
        <button onClick={() => input.current?.click()}>Import workspace</button>
        <button onClick={() => safely(() => {
          download(recovery ?? exportRawWorkspaceRecovery(state), 'biomechanics-workspace-recovery.json');
          onNotice('Raw recovery downloaded. It preserves original stored contents, including unreadable data, for recovery and inspection.');
        })}>Download raw recovery</button>
        <input ref={input} hidden type="file" accept=".json,application/json" aria-label="Import whole workspace file" onChange={event => void read(event.target.files?.[0])} />
      </div>
      {error && <p role="alert">{error}</p>}
      {pending && <div className="workspace-import-preview">
        <p><strong>Ready to restore these sections</strong></p>
        <ul>{workspaceSummary(pending.data).map(section => <li key={section.label}>{section.label}: {section.present ? `${section.records} ${section.records === 1 ? 'item' : 'items'}` : 'empty in this backup'}</li>)}</ul>
        {pending.data.modelUpdates?.length ? <p role="status">Some comparisons will be recalculated with the current mechanics: {pending.data.modelUpdates.join('; ')}. Review their results after restoring. Your original file is unchanged.</p> : null}
        <p className="small-note">Restoring replaces the included sections, including sections marked empty. Your current stored contents are backed up first. Other browser data and previous backups are retained. Reloading opens the restored workspaces.</p>
        <div className="reset-controls">
          <button onClick={() => safely(() => {
            flushWorkspaceEdits();
            const result = restoreWorkspaceBackup(pending.raw, state);
            setPending(null);
            onNotice(`Restored ${result.stores} workspace sections containing ${result.records} items. A recovery copy of the previous workspace was retained.${result.modelUpdates.length ? ` Mechanics recalculated: ${result.modelUpdates.join('; ')}.` : ''}`);
            onRestored();
          })}>Restore & reload</button>
          <button onClick={() => setPending(null)}>Cancel import</button>
        </div>
      </div>}
    </div>
  </details>;
}
