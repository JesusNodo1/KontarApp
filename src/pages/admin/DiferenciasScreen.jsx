import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { B } from '../../constants/theme'
import { supabase } from '../../services/supabase'
import { fmtFecha } from '../../services/conteoService'
import Spinner from '../../components/Spinner'
import DiferenciasPanel from './DiferenciasPanel'

export default function DiferenciasScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [inv,    setInv]    = useState(null)
  const [load,   setLoad]   = useState(true)
  const [error,  setError]  = useState('')

  useEffect(() => {
    setLoad(true)
    supabase
      .from('inventarios')
      .select('id, nombre, sucursal, deposito, deposito_id, fecha_inicio, fecha_limite, estado, responsable')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error)      setError(error.message)
        else if (!data) setError('Inventario no encontrado')
        else            setInv(data)
      })
      .finally(() => setLoad(false))
  }, [id])

  if (load) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>

  if (error) return (
    <div style={{ padding: '24px 20px', maxWidth: 700, margin: '0 auto' }}>
      <button onClick={() => navigate('/admin/inventarios')} style={{ background: 'none', border: 'none', color: B, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 14, padding: 0 }}>
        ← Volver a Inventarios
      </button>
      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '12px 16px', color: '#DC2626', fontSize: 13 }}>✕ {error}</div>
    </div>
  )

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
      {/* breadcrumb */}
      <button
        onClick={() => navigate('/admin/inventarios')}
        style={{ background: 'none', border: 'none', color: B, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 14, padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        ← Inventarios
      </button>

      {/* header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>Diferencias · {inv.nombre}</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          {inv.sucursal}{inv.deposito ? ` · ${inv.deposito}` : ''}
          {inv.fecha_inicio && ` · ${fmtFecha(inv.fecha_inicio)}`}
          {inv.fecha_limite && ` → ${fmtFecha(inv.fecha_limite)}`}
          {' · '}<span style={{ color: inv.estado === 'abierto' ? '#059669' : '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>{inv.estado}</span>
        </div>
      </div>

      <DiferenciasPanel inventario={inv} />
    </div>
  )
}
