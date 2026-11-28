// TEMPORARY: see authDebug.ts.
import { useState } from 'react'
import { clearAuthDebugLog, loadSnapshot, readAuthDebugLog } from './authDebug'

export function AuthDebugPanel() {
  const [log, setLog] = useState(readAuthDebugLog)
  const [copied, setCopied] = useState(false)
  const text = `== Storage at this page load ==\n${loadSnapshot}\n\n== Event log (oldest first) ==\n${log.join('\n') || '(empty)'}`

  return (
    <div style={{ padding: 12, color: '#eee', background: '#111', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 18 }}>Auth debug</h1>
      <p style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setCopied(true))
          }}
        >
          {copied ? 'Copied' : 'Copy all'}
        </button>
        <button
          type="button"
          onClick={() => {
            clearAuthDebugLog()
            setLog([])
          }}
        >
          Clear log
        </button>
        <a href={import.meta.env.BASE_URL} style={{ color: '#8cf' }}>
          Back to app
        </a>
      </p>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>{text}</pre>
    </div>
  )
}
