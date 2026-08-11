'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import FileDropzone from '@/Componentes/ui/FileDropzone';
import Aviso from '@/Componentes/ui/Aviso';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';

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
  const {
    datos: metodos,
    error,
    cargando,
    recargar,
  } = useCargaDatos(() => datosDe<MetodoPago>(supabase.from('metodos_pago_config').select('*').order('metodo')));

  return (
    <>
      <h1 className="titulo">Métodos de pago</h1>
      <p className="sub">
        Descripción de cada método (número de cuenta, CCI, número de Yape, QR, etc.) que se muestra al alumno en el
        checkout del aula cuando elige Transferencia o Yape. Solo se acepta Yape — no Plin.
      </p>
      <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} variante="bloque">
        {(metodos || []).map((m) => (
          <FilaMetodo key={m.id} metodo={m} />
        ))}
      </EstadoCarga>
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
  const [guardando, setGuardando] = useState(false);
  const [subiendoQr, setSubiendoQr] = useState(false);
  const [quitandoQr, setQuitandoQr] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function guardar() {
    setAviso(null);
    setGuardando(true);
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
    setGuardando(false);
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
    setQuitandoQr(true);
    const { error } = await supabase.from('metodos_pago_config').update({ qr_url: null, actualizado_en: new Date().toISOString() }).eq('id', metodo.id);
    setQuitandoQr(false);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    setQrUrl('');
  }

  // Los ids se derivan del método para que las etiquetas de las tres tarjetas
  // (transferencia, yape, …) no apunten todas al mismo campo.
  const id = (campo: string) => `mp-${metodo.metodo}-${campo}`;

  return (
    <div className="card card-pad" style={{ marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 1rem' }}>{metodo.titulo || metodo.metodo}</h3>
      <Aviso mensaje={aviso} />
      <div className="fila" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <label htmlFor={id('titular')}>Titular</label>
          <input id={id('titular')} value={titular} onChange={(e) => setTitular(e.target.value)} />
          <div className="fila">
            <div style={{ flex: 1 }}>
              <label htmlFor={id('numero')}>Número (cuenta / Yape)</label>
              <input id={id('numero')} value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor={id('banco')}>Banco (si aplica)</label>
              <input id={id('banco')} value={banco} onChange={(e) => setBanco(e.target.value)} />
            </div>
          </div>
          <label htmlFor={id('cci')}>CCI (si aplica)</label>
          <input id={id('cci')} value={cci} onChange={(e) => setCci(e.target.value)} placeholder="002-193-..." />
          <label htmlFor={id('instrucciones')}>Instrucciones / descripción para el alumno</label>
          <textarea id={id('instrucciones')} rows={3} value={instrucciones} onChange={(e) => setInstrucciones(e.target.value)} />
        </div>

        <div style={{ width: 150, flexShrink: 0, textAlign: 'center' }}>
          <span className="campo-label">Código QR (opcional)</span>
          {qrUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt={`QR de ${metodo.titulo || metodo.metodo}`} style={{ width: 130, height: 130, objectFit: 'contain', border: '1px solid var(--borde)', borderRadius: 8, background: '#fff' }} />
              <button className="btn sec btn-sm" style={{ marginTop: '.5rem', width: '100%' }} onClick={quitarQr} disabled={quitandoQr}>
                {quitandoQr ? 'Quitando…' : 'Quitar QR'}
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
      <button className="btn btn-sm" style={{ marginTop: '.8rem' }} onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : `Guardar ${metodo.titulo || metodo.metodo}`}
      </button>
      {guardado && (
        <span className="meta" role="status" style={{ color: 'var(--ok)', marginLeft: '.6rem' }}>
          Guardado ✓
        </span>
      )}
    </div>
  );
}
