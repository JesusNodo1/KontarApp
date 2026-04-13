import { B, G } from '../constants/theme'

export default function ProgBar({ value, total, color = B, height = 6 }) {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Avance
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? G : color, fontFamily: "'DM Mono',monospace" }}>
          {value}/{total} · {pct}%
        </span>
      </div>
      <div style={{ background: '#E5E7EB', height, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? G : color, transition: 'width .4s' }} />
      </div>
    </div>
  )
}
