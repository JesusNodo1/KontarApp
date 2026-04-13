import { G } from '../../../constants/theme'

export default function ModalCam({ vidRef, camR, camE, onCerrar }) {
  const corners = [
    { top: 0,    left:  0 },
    { top: 0,    right: 0 },
    { bottom: 0, left:  0 },
    { bottom: 0, right: 0 },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.93)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 20 }}>
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

      {camE
        ? <div style={{ color: '#FCA5A5', fontSize: 14, textAlign: 'center', maxWidth: 300 }}>{camE}</div>
        : !camR
          ? <div style={{ color: '#9CA3AF', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="spin" style={{ width: 16, height: 16, border: '2px solid #4B5563', borderTopColor: G, borderRadius: '50%' }} />
              Iniciando cámara...
            </div>
          : <div style={{ color: '#D1D5DB', fontSize: 14 }}>Apuntá al código de barras</div>
      }

      <button onClick={onCerrar} style={{ padding: '13px 36px', background: 'transparent', border: '2px solid #4B5563', color: '#D1D5DB', fontWeight: 600, fontSize: 14, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Cancelar
      </button>
    </div>
  )
}
