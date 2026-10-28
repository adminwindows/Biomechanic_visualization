import { Component, type ErrorInfo, type ReactNode } from 'react';

type RecoveryStorage = Pick<Storage, 'length' | 'key' | 'getItem'>;
/** Exact strings, including recovery snapshots and unknown future schemas; no mutation or parsing. */
export function captureAppRecovery(storage: RecoveryStorage = localStorage): string {
  const entries: { key: string; raw: string | null }[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && (key.startsWith('biomechanics.') || key.startsWith('exercise-biomechanics-lab.'))) entries.push({ key, raw: storage.getItem(key) });
  }
  return JSON.stringify({ format: 'biomechanics-error-recovery', version: 1, exportedAt: new Date().toISOString(), entries }, null, 2);
}
type BoundaryState = { error: string | null; exportError: string | null };
export class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null, exportError: null };
  static getDerivedStateFromError(error: unknown): BoundaryState { return { error: error instanceof Error ? error.message : String(error), exportError: null }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Recovery stays local; no automatic reporting or storage changes. */ }
  download = () => {
    try {
      const raw = captureAppRecovery(), url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })), link = document.createElement('a');
      link.href = url; link.download = 'biomechanics-error-recovery.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); this.setState({ exportError: null });
    } catch (error) { this.setState({ exportError: `The saved data could not be read for export. ${error instanceof Error ? error.message : ''}` }); }
  };
  render() {
    if (!this.state.error) return this.props.children;
    return <main style={{ maxWidth: 760, margin: '8vh auto', padding: 24, fontFamily: '"Instrument Sans", system-ui, sans-serif', lineHeight: 1.65, color: '#172b3a', background: '#f3f5f7', border: '1px solid #dce3e8', borderRadius: 12 }}>
      <h1 style={{ fontSize: 27 }}>The workspace encountered an error</h1><p role="alert">A view could not render. This recovery screen does not erase or replace saved browser data.</p><p>Download the saved originals before reloading. This file preserves exact app-storage strings, including existing backups; unsaved in-memory edits may not be recoverable.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><button style={{ padding: '12px 16px' }} onClick={this.download}>Download saved-data recovery</button><button style={{ padding: '12px 16px' }} onClick={() => window.location.reload()}>Reload application</button><button style={{ padding: '12px 16px' }} onClick={() => this.setState({ error: null })}>Try rendering again</button></div>
      {this.state.exportError && <p role="status">{this.state.exportError}</p>}<details style={{ marginTop: 20 }}><summary>Error details</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{this.state.error.slice(0, 3000)}</pre></details><p style={{ fontSize: 12 }}>Recovery downloads are for inspection and repair. They are not silently imported as validated workspace data.</p>
    </main>;
  }
}
