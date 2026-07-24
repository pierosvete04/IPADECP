'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import FileDropzone from '@/Componentes/ui/FileDropzone';

interface MetodoPago {
  id: number;
  metodo: string;
  titulo: string | null;
  titular: string | null;
  numero: string | null;
  banco: string | null;
  cci: string | null;
  qr_url: string | null;
  instrucciones: string | null;
}

export default function MetodosPagoSection() {
  const [metodos, setMetodos] = useState<MetodoPago[] | null>(null);

  useEffect(() => {
    supabase
      .from('metodos_pago_config')
      .select('*')
      .order('metodo')
      .then(({ data }) => setMetodos(data || []));
  }, []);

  return (
    <>
      <h1 className="titulo">Métodos de pago</h1>
      <p className="sub">
        Descripción de cada método (número de cuenta, CCI, número de Yape/Plin, QR, etc.) que se muestra al alumno en el
        checkout del aula cuando elige Transferencia o Yape/Plin.
      </p>
      {metodos === null ? <p>Cargando…</p> : metodos.map((m) => <FilaMetodo key={m.id} metodo={m} />)}
    </>
  );
}

function FilaMetodo({ metodo }: { metodo: MetodoPago }) {
  const [titular, setTitular] = useState(metodo.titular || '');
  const [numero, setNumero] = useState(metodo.numero || '');
  const [banco, setBanco] = useState(metodo.banco || '');
  const [cci, setCci] = useState(metodo.cci || '');
  const [qrUrl, setQrUrl] = useState(metodo.qr_url || '');
  const [instrucciones, setInstrucciones] = useState(metodo.instrucciones || '');
  const [guardado, setGuardado] = useState(false);
  const [subiendoQr, setSubiendoQr] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function guardar() {
    setAviso(null);
    const { error } = await supabase
      .from('metodos_pago_config')
      .update({
        titular: titular.trim(),
        numero: numero.trim(),
        banco: banco.trim(),
        cci: cci.trim(),
        instrucciones: instrucciones.trim(),
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', metodo.id);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1800);
  }

  async function subirQr(file: File | null) {
    if (!file) return;
    setAviso(null);
    setSubiendoQr(true);
    const ext = file.name.split('.').pop() || 'png';
    const ruta = `metodos-pago/${metodo.metodo}-${Date.now()}.${ext}`;
    const { error: eUp } = await supabase.storage.from('cursos-imagenes').upload(ruta, file, { upsert: true });
    if (eUp) {
      setAviso(mensajeError(eUp, 'No se pudo subir el QR.'));
      setSubiendoQr(false);
      return;
    }
    const { data } = supabase.storage.from('cursos-imagenes').getPublicUrl(ruta);
    const { error: eGuardar } = await supabase
      .from('metodos_pago_config')
      .update({ qr_url: data.publicUrl, actualizado_en: new Date().toISOString() })
      .eq('id', metodo.id);
    setSubiendoQr(false);
    if (eGuardar) {
      setAviso(mensajeError(eGuardar));
      return;
    }
    setQrUrl(data.publicUrl);
  }

  async function quitarQr() {
    setAviso(null);
    const { error } = await supabase.from('metodos_pago_config').update({ qr_url: null, actualizado_en: new Date().toISOString() }).eq('id', metodo.id);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    setQrUrl('');
  }

  return (
    <div className="card card-pad" style={{ marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 1rem' }}>{metodo.titulo || metodo.metodo}</h3>
      {aviso && <div className="aviso err">{aviso}</div>}
      <div className="fila" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <label>Titular</label>
          <input value={titular} onChange={(e) => setTitular(e.target.value)} />
          <div className="fila">
            <div style={{ flex: 1 }}>
              <label>Número (cuenta / Yape / Plin)</label>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Banco (si aplica)</label>
              <input value={banco} onChange={(e) => setBanco(e.target.value)} />
            </div>
          </div>
          <label>CCI (si aplica)</label>
          <input value={cci} onChange={(e) => setCci(e.target.value)} placeholder="002-193-..." />
          <label>Instrucciones / descripción para el alumno</label>
          <textarea rows={3} value={instrucciones} onChange={(e) => setInstrucciones(e.target.value)} />
        </div>

        <div style={{ width: 150, flexShrink: 0, textAlign: 'center' }}>
          <label>Código QR (opcional)</label>
          {qrUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt={`QR de ${metodo.metodo}`} style={{ width: 130, height: 130, objectFit: 'contain', border: '1px solid var(--borde)', borderRadius: 8, background: '#fff' }} />
              <button className="btn sec btn-sm" style={{ marginTop: '.5rem', width: '100%' }} onClick={quitarQr}>
                Quitar QR
              </button>
            </>
          ) : (
            <FileDropzone
              compacto
              accept="image/*"
              cargando={subiendoQr}
              onFile={subirQr}
              icon={<span className="material-symbols-outlined">qr_code_2</span>}
              label="Subir imagen QR"
            />
          )}
        </div>
      </div>
      <button className="btn btn-sm" style={{ marginTop: '.8rem' }} onClick={guardar}>
        Guardar
      </button>
      {guardado && (
        <span className="meta" style={{ color: 'var(--ok)', marginLeft: '.6rem' }}>
          Guardado ✓
        </span>
      )}
    </div>
  );
}
