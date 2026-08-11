'use client';

import { ArrowLeft, Mail, Phone } from 'lucide-react';
import Avatar from '@/Componentes/ui/Avatar';
import { formatSoles } from '@/lib/copy';
import { haceCuanto } from '@/lib/alumno';
import { whatsappLink } from '@/lib/site-config';

export interface ResumenCliente {
  nombre: string;
  email: string | null;
  correoContacto: string | null;
  telefono: string | null;
  documento: string | null;
  tipoDocumento: string | null;
  documentoVerificado: boolean;
  avatarKey: string | null;
  creadoEn: string | null;
  totalPagado: number;
  pedidos: number;
  cursos: number;
  certificados: number;
  nivel: string | null;
  datosFaltantes: string[];
  /** `auth.users.last_sign_in_at`. Null = nunca entró al aula. */
  ultimoAcceso: string | null;
}

/**
 * Cabecera de la ficha de cliente.
 *
 * La ficha abría directamente en un formulario de doce campos: lo primero que
 * veía el admin era "Nombres / Apellidos" en vez de quién es esta persona y qué
 * ha hecho. Las preguntas reales al abrir una ficha —cuánto ha pagado, cuántos
 * cursos tiene, si le falta algún dato para poder certificarlo— o estaban
 * enterradas al final o no estaban. Acá arriba se responden todas de un vistazo,
 * y editar pasa a ser una acción deliberada.
 */
export default function CabeceraCliente({ resumen, onVolver }: { resumen: ResumenCliente; onVolver: () => void }) {
  const correo = resumen.correoContacto || resumen.email;

  return (
    <header className="ficha-cliente">
      <button type="button" className="btn sec btn-sm ficha-cliente-volver" onClick={onVolver}>
        <ArrowLeft size={16} /> Volver a clientes
      </button>

      <div className="ficha-cliente-identidad">
        <Avatar avatarKey={resumen.avatarKey} nombreRef={resumen.nombre} size={56} />
        <div className="ficha-cliente-quien">
          <h1 className="titulo">{resumen.nombre}</h1>
          <p className="ficha-cliente-meta">
            {resumen.documento ? (
              <span>
                {resumen.tipoDocumento || 'DNI'} {resumen.documento}
                {resumen.documentoVerificado ? (
                  <span className="tag activo">Verificado con RENIEC</span>
                ) : (
                  <span className="tag canjeado">Autodeclarado</span>
                )}
              </span>
            ) : (
              <span className="tag canjeado">Sin documento</span>
            )}
            {resumen.creadoEn && (
              <span className="campo-ayuda">Cliente desde {new Date(resumen.creadoEn).toLocaleDateString('es-PE')}</span>
            )}
          </p>
        </div>

        {/* Dos canales, cada uno con su nombre y su destino a la vista. Decían
            "WhatsApp" y "Escribir": el segundo no revelaba que abría el correo,
            y ninguno mostraba a qué número o dirección iba. */}
        <div className="ficha-cliente-acciones">
          {resumen.telefono && (
            <a
              className="btn sec btn-sm"
              href={whatsappLink(resumen.telefono.replace(/\D/g, ''))}
              target="_blank"
              rel="noreferrer"
              title={`Abrir WhatsApp con ${resumen.telefono}`}
            >
              <Phone size={14} /> WhatsApp
            </a>
          )}
          {correo && (
            <a className="btn sec btn-sm" href={`mailto:${correo}`} title={`Escribir a ${correo}`}>
              <Mail size={14} /> Correo
            </a>
          )}
          {!resumen.telefono && !correo && <span className="campo-ayuda">Sin teléfono ni correo registrados.</span>}
        </div>
      </div>

      {/* Cifras en la cabecera, no en un pie de tarjeta: son el motivo por el
          que la mayoría de las veces se abre esta pantalla. */}
      <dl className="ficha-cliente-cifras">
        <div>
          <dt>Total pagado</dt>
          <dd>{formatSoles(resumen.totalPagado)}</dd>
        </div>
        <div>
          <dt>Pedidos</dt>
          <dd>{resumen.pedidos}</dd>
        </div>
        <div>
          <dt>Cursos</dt>
          <dd>{resumen.cursos}</dd>
        </div>
        <div>
          <dt>Certificados</dt>
          <dd>{resumen.certificados}</dd>
        </div>
        <div>
          <dt>Nivel</dt>
          <dd>{resumen.nivel || '—'}</dd>
        </div>
        {/* Distingue a quien compró y nunca entró de quien entra a diario. Es la
            pregunta comercial más útil de la ficha y no estaba en ninguna parte. */}
        <div>
          <dt>Último acceso</dt>
          <dd className={resumen.ultimoAcceso ? undefined : 'cifra-apagada'}>{haceCuanto(resumen.ultimoAcceso)}</dd>
        </div>
      </dl>

      {/* Los datos que faltan se nombran uno por uno. La lista antes solo tenía
          un punto rojo con un `title`, que no dice cuál falta ni se ve en móvil. */}
      {resumen.datosFaltantes.length > 0 && (
        <p className="ficha-cliente-faltan" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">
            info
          </span>
          Faltan datos para poder certificar a esta persona: <strong>{resumen.datosFaltantes.join(', ')}</strong>.
        </p>
      )}
    </header>
  );
}
