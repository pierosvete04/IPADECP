'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Topbar from '@/Componentes/layout/Topbar';
import Footer from '@/Componentes/layout/Footer';

type TipoSolicitud = 'Reclamo' | 'Queja';
type TipoBien = 'Producto' | 'Servicio';

export default function ReclamosClient() {
  const router = useRouter();

  const [tipoSolicitud, setTipoSolicitud] = useState<TipoSolicitud>('Reclamo');
  const [bienTipo, setBienTipo] = useState<TipoBien>('Producto');
  const [nombre, setNombre] = useState('');
  const [tpodoc, setTpodoc] = useState('DNI');
  const [numdoc, setNumdoc] = useState('');
  const [cel, setCel] = useState('');
  const [correo, setCorreo] = useState('');
  const [dir, setDir] = useState('');
  const [menor, setMenor] = useState(false);
  const [bienDesc, setBienDesc] = useState('');
  const [monto, setMonto] = useState('');
  const [msg, setMsg] = useState('');
  const [pedido, setPedido] = useState('');
  const [declaro, setDeclaro] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  function resumenTexto() {
    return (
      `Tipo de solicitud: ${tipoSolicitud}\n` +
      `Nombre: ${nombre.trim()}\n` +
      `Documento: ${tpodoc} ${numdoc.trim()}\n` +
      `Correo: ${correo.trim()}\n` +
      `Teléfono: ${cel.trim()}\n` +
      `Bien: ${bienTipo} — ${bienDesc.trim()}\n` +
      `Monto reclamado: S/ ${monto.trim() || '0.00'}\n\n` +
      `Detalle:\n${msg.trim()}\n\n` +
      `Pedido del consumidor:\n${pedido.trim()}`
    );
  }

  function enviarCopia() {
    const asunto = encodeURIComponent(`Copia de ${tipoSolicitud.toLowerCase()} — Libro de Reclamaciones IPADECP`);
    const cuerpo = encodeURIComponent(resumenTexto());
    window.location.href = `mailto:${correo.trim()}?subject=${asunto}&body=${cuerpo}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const fila = {
      tipo_solicitud: tipoSolicitud,
      tpodoc,
      numerodoc: numdoc.trim(),
      nombrecomplet: nombre.trim(),
      correo: correo.trim(),
      numcel: cel.trim(),
      direccion: dir.trim(),
      menor_edad: menor,
      bien_tipo: bienTipo,
      bien_descripcion: bienDesc.trim(),
      monto_reclamado: monto.trim() ? Number(monto.trim()) : null,
      mensaje: msg.trim(),
      pedido_consumidor: pedido.trim(),
      alumno_uid: session?.user?.id || null,
    };
    const { error } = await supabase.from('reclamos').insert(fila);
    setEnviando(false);
    if (error) {
      setAviso({ texto: 'No se pudo enviar el reclamo: ' + error.message, tipo: 'err' });
      return;
    }
    setAviso({ texto: 'Tu reclamo fue registrado correctamente. Te contactaremos pronto.', tipo: 'ok' });
    setEnviado(true);
  }

  return (
    <>
      <Topbar variant="simple" onSimpleClick={() => router.push('/aula')} />
      <main className="reclamos-wrap">
        <div className="reclamos-header">
          <div className="reclamos-header-ico">📖</div>
          <div>
            <h1>Libro de Reclamaciones</h1>
            <p>Conforme al Código de Protección y Defensa del Consumidor (Ley N.° 29571) y su Reglamento (D.S. N.° 011-2011-PCM).</p>
            <span className="hoja-num">Hoja de Reclamación N.° —</span>
          </div>
        </div>

        <div className="card card-pad reclamos-card">
          <h3 className="reclamos-card-titulo">🏢 Datos del proveedor</h3>
          <div className="datos-proveedor-grid">
            <div>
              <span className="lbl">Razón social</span>
              <strong>Instituto Peruano Americano de Desarrollo y Capacitación Profesional IPADECP S.A.C.</strong>
            </div>
            <div>
              <span className="lbl">RUC</span>
              <strong>20600819420</strong>
            </div>
            <div>
              <span className="lbl">Domicilio fiscal</span>
              <strong>
                Av. Ejemplo 123, Lima <em>(dato de ejemplo)</em>
              </strong>
            </div>
            <div>
              <span className="lbl">Correo de atención</span>
              <strong>
                contacto@ipadecp.com <em>(dato de ejemplo)</em>
              </strong>
            </div>
          </div>
        </div>

        <div className="card card-pad reclamos-card">
          <h3 className="reclamos-card-titulo">❓ ¿Reclamo o queja?</h3>
          <div className="reclamo-queja-info">
            <div className="rq-col rq-reclamo">
              <strong>⚠️ Reclamo</strong>
              <p>Disconformidad relacionada con el producto o servicio adquirido (ej. el producto llegó dañado, no era lo solicitado, etc.).</p>
            </div>
            <div className="rq-col rq-queja">
              <strong>💬 Queja</strong>
              <p>Disconformidad no relacionada con el producto o servicio, sino con la atención al cliente (ej. mala atención).</p>
            </div>
          </div>
        </div>

        {!enviado && (
          <form onSubmit={handleSubmit}>
            <div className="card card-pad reclamos-card">
              <h3 className="reclamos-card-titulo">🚩 Tipo de solicitud *</h3>
              <div className="toggle-grande">
                <button type="button" className={`toggle-opcion${tipoSolicitud === 'Reclamo' ? ' activo' : ''}`} onClick={() => setTipoSolicitud('Reclamo')}>
                  <strong>⚠️ Reclamo</strong>
                  <span>Sobre el producto o servicio</span>
                </button>
                <button type="button" className={`toggle-opcion${tipoSolicitud === 'Queja' ? ' activo' : ''}`} onClick={() => setTipoSolicitud('Queja')}>
                  <strong>💬 Queja</strong>
                  <span>Sobre la atención recibida</span>
                </button>
              </div>
            </div>

            <div className="card card-pad reclamos-card">
              <h3 className="reclamos-card-titulo">👤 1. Identificación del consumidor reclamante</h3>
              <label>Nombre completo *</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              <div className="fila">
                <div style={{ flex: 1 }}>
                  <label>Tipo de documento *</label>
                  <select value={tpodoc} onChange={(e) => setTpodoc(e.target.value)}>
                    <option value="DNI">DNI</option>
                    <option value="Carné de extranjería">Carné de extranjería</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>N.° de documento *</label>
                  <input value={numdoc} onChange={(e) => setNumdoc(e.target.value)} required />
                </div>
              </div>
              <div className="fila">
                <div style={{ flex: 1 }}>
                  <label>Teléfono</label>
                  <input value={cel} onChange={(e) => setCel(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Correo electrónico *</label>
                  <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
                </div>
              </div>
              <label>Domicilio</label>
              <input value={dir} onChange={(e) => setDir(e.target.value)} />
              <label className="chk">
                <input type="checkbox" checked={menor} onChange={(e) => setMenor(e.target.checked)} /> El consumidor es menor de
                edad (se requieren datos del padre/madre/apoderado)
              </label>
            </div>

            <div className="card card-pad reclamos-card">
              <h3 className="reclamos-card-titulo">📦 2. Identificación del bien contratado</h3>
              <div className="toggle-grande toggle-chico">
                <button type="button" className={`toggle-opcion${bienTipo === 'Producto' ? ' activo' : ''}`} onClick={() => setBienTipo('Producto')}>
                  📦 Producto
                </button>
                <button type="button" className={`toggle-opcion${bienTipo === 'Servicio' ? ' activo' : ''}`} onClick={() => setBienTipo('Servicio')}>
                  🔧 Servicio
                </button>
              </div>
              <label>Descripción del producto / servicio</label>
              <input value={bienDesc} onChange={(e) => setBienDesc(e.target.value)} placeholder="Ej: Curso de Farmacología, código IP-1234" />
              <label>Monto reclamado (S/)</label>
              <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
            </div>

            <div className="card card-pad reclamos-card">
              <h3 className="reclamos-card-titulo">📝 3. Detalle de la reclamación</h3>
              <label>Detalle del reclamo *</label>
              <textarea rows={4} required placeholder="Describe con claridad lo sucedido…" value={msg} onChange={(e) => setMsg(e.target.value)} />
              <label>Pedido del consumidor (lo que solicitas)</label>
              <textarea rows={3} placeholder="Ej: Solicito el cambio del producto / la devolución del monto…" value={pedido} onChange={(e) => setPedido(e.target.value)} />
            </div>

            {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}

            <div className="reclamos-legal">
              <p>
                <strong>Importante:</strong> el proveedor debe dar respuesta al reclamo en un plazo no mayor a quince (15) días
                hábiles, el cual puede ser extendido por otro igual de ser necesario, comunicando esto al consumidor. La
                formulación del reclamo no impide acudir a otras vías de resolución de controversias ni es requisito previo para
                una denuncia ante el INDECOPI.
              </p>
              <label className="chk">
                <input type="checkbox" checked={declaro} onChange={(e) => setDeclaro(e.target.checked)} required /> Declaro que los
                datos consignados son veraces y autorizo su tratamiento para la atención de esta solicitud, conforme a la{' '}
                <a href="/politica-privacidad" target="_blank">
                  Política de Privacidad
                </a>
                .
              </label>
            </div>

            <div className="reclamos-acciones">
              <button type="button" className="btn sec" onClick={enviarCopia}>
                Enviar copia por correo
              </button>
              <button type="submit" className="btn" disabled={enviando || !declaro}>
                Registrar en el Libro
              </button>
            </div>
          </form>
        )}
        {enviado && aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}
      </main>
      <Footer />
    </>
  );
}
