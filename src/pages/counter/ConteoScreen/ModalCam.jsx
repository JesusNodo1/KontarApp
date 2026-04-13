import { G } from '../../../constants/theme'

export default function ModalCam({ vidRef, camR, camE, onCerrar, lastScan }) {
  const corners = [
    { top: 0,    left:  0 },
    { top: 0,    right: 0 },
    { bottom: 0, left:  0 },
    { bottom: 0, right: 0 },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.93)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 }}>
      {/* Viewfinder */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
        <video ref={vidRef} style={{ width: '100%', display: 'block', background: '#000' }} playsInline muted autoPlay />
        {corners.map((pos, i) => {
          const bt = i < 2  ? `3px solid ${G}` : undefined
          const bb = i >= 2 ? `3px solid ${G}` : undefined
          const bl = i % 2 === 0 ? `3px solid ${G}` : undefined
          const br = i % 2 === 1 ? `3px solid ${G}` : undefined
          return <div key={i} style={{ position: 'absolute', width: 26, height: 26, borderTop: bt, borderBottom: bb, borderLeft: bl, borderRight: br, ...pos }} />
        })}
        {camR && <div className="pulse" style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: G }} />}
      </div>

      {/* Estado */}
      {camE
        ? <div style={{ color: '#FCA5A5', fontSize: 14, textAlign: 'center', maxWidth: 300 }}>{camE}</div>
        : !camR
          ? <div style={{ color: '#9CA3AF', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="spin" style={{ width: 16, height: 16, border: '2px solid #4B5563', borderTopColor: G, borderRadius: '50%' }} />
              Iniciando cámara...
            </div>
          : <div style={{ color: '#D1D5DB', fontSize: 13 }}>Apuntá al código de barras</div>
      }

      {/* Último producto escaneado */}
      {lastScan && (
        <div style={{ width: '100%', maxWidth: 360, background: '#052e16', border: '1px solid #16a34a', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="square">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#4ade80', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lastScan.nombre}{lastScan.variante ? ` · ${lastScan.variante}` : ''}
            </div>
            <div style={{ color: '#86efac', fontSize: 11, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>
              {lastScan.sku} · +1 registrado
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onCerrar}
        style={{ padding: '13px 36px', background: 'transparent', border: '2px solid #4B5563', color: '#D1D5DB', fontWeight: 600, fontSize: 14, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' }}
      >
        Cerrar cámara
      </button>
    </div>
  )
}
