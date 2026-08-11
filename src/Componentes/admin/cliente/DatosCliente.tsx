'use client';

import { useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import type { CargoProfesional } from '@/lib/cargos';
import { DEPARTAMENTOS_PERU } from '@/lib/envioCertificado';

export interface DatosEditables {
  nombres: string;
  apellidos: string;
  telefono: string;
  telefonoAlternativo: string;
  correoContacto: string;
  documento: string;
  tipoDocumento: string;
  cargo: string;
  departamento: string;
  distrito: string;
  genero: string;
  fechaNacimiento: string;
}

const GENERO_LABEL: Record<string, string> = {
  femenino: 'Femenino',
  masculino: 'Masculino',
  otro: 'Otro',
};

/**
 * Datos del cliente, en lectura por defecto.
 *
 * Antes los doce campos estaban abiertos como inputs de forma permanente. Eso
 * tenía tres problemas: la ficha se leía como un formulario y no como el
 * expediente de una persona, cualquier clic distraído modificaba un dato que se
 * imprime en certificados, y "Guardar cambios" estaba siempre activo aunque no
 * hubiera nada que guardar. Ahora se lee, y editar es una decisión.
 */
export default function DatosCliente({
  valores,
  correoAcceso,
  documentoVerificado,
  cargos,
  guardando,
  onGuardar,
}: {
  valores: DatosEditables;
  correoAcceso: string | null;
  documentoVerificado: boolean;
  cargos: CargoProfesional[];
  guardando: boolean;
  onGuardar: (valores: DatosEditables) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<DatosEditables>(valores);

  // Comparar contra los valores guardados evita el "Guardar" siempre encendido
  // y permite avisar si se intenta cerrar con cambios sin guardar.
  const sucio = useMemo(
    () => (Object.keys(valores) as (keyof DatosEditables)[]).some((k) => (borrador[k] || '') !== (valores[k] || '')),
    [borrador, valores]
  );

  function abrir() {
    setBorrador(valores);
    setEditando(true);
  }

  function cancelar() {
    if (sucio && !window.confirm('Tienes cambios sin guardar. ¿Descartarlos?')) return;
    setBorrador(valores);
    setEditando(false);
  }

  function set<K extends keyof DatosEditables>(campo: K, valor: DatosEditables[K]) {
    setBorrador((b) => ({ ...b, [campo]: valor }));
  }

  const nombreCompleto = [valores.nombres, valores.apellidos].filter(Boolean).join(' ');

  if (!editando) {
    return (
      <section className="card card-pad separado" aria-labelledby="datos-titulo">
        <div className="fila-entre">
          <h2 id="datos-titulo" className="bloque-titulo">
            Datos del cliente
          </h2>
          <button type="button" className="btn sec btn-sm" onClick={abrir}>
            <Pencil size={14} /> Editar
          </button>
        </div>

        <dl className="datos-lectura">
          <Dato etiqueta="Nombre completo" valor={nombreCompleto} destacado />
          <Dato etiqueta="Documento" valor={valores.documento ? `${valores.tipoDocumento} ${valores.documento}` : ''} />
          <Dato etiqueta="Cargo profesional" valor={valores.cargo} />
          <Dato etiqueta="Teléfono" valor={valores.telefono} />
          <Dato etiqueta="Teléfono alternativo" valor={valores.telefonoAlternativo} />
          <Dato etiqueta="Correo de acceso" valor={correoAcceso || ''} />
          <Dato etiqueta="Correo de contacto" valor={valores.correoContacto} />
          <Dato
            etiqueta="Ubicación"
            valor={[valores.distrito, valores.departamento].filter(Boolean).join(', ')}
          />
          <Dato etiqueta="Género" valor={GENERO_LABEL[valores.genero] || ''} />
          <Dato
            etiqueta="Fecha de nacimiento"
            valor={valores.fechaNacimiento ? new Date(valores.fechaNacimiento + 'T00:00:00').toLocaleDateString('es-PE') : ''}
          />
        </dl>

        {documentoVerificado && (
          <p className="campo-ayuda">
            El documento fue verificado contra RENIEC. Cambiarlo a mano hace que el certificado deje de coincidir con el
            nombre verificado.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="card card-pad separado" aria-labelledby="datos-titulo">
      <h2 id="datos-titulo" className="bloque-titulo">
        Editando datos del cliente
      </h2>
      <p className="campo-ayuda">
        El nombre y el documento se imprimen en los certificados que se emitan de aquí en adelante. Los certificados ya
        emitidos conservan el nombre con el que salieron.
      </p>

      <div className="perfil-grid">
        <div>
          <label htmlFor="dc-nombres">Nombres</label>
          <input id="dc-nombres" value={borrador.nombres} onChange={(e) => set('nombres', e.target.value)} />
        </div>
        <div>
          <label htmlFor="dc-apellidos">Apellidos</label>
          <input id="dc-apellidos" value={borrador.apellidos} onChange={(e) => set('apellidos', e.target.value)} />
        </div>
      </div>

      <div className="perfil-grid">
        <div>
          <label htmlFor="dc-email">Correo de acceso al aula</label>
          <input id="dc-email" value={correoAcceso || ''} disabled />
          <span className="campo-ayuda">Se cambia desde la cuenta del alumno, no desde aquí.</span>
        </div>
        <div>
          <label htmlFor="dc-correo">Correo de contacto</label>
          <input
            id="dc-correo"
            type="email"
            value={borrador.correoContacto}
            onChange={(e) => set('correoContacto', e.target.value)}
            placeholder="Si es distinto al de acceso"
          />
          <span className="campo-ayuda">A este correo se le envían los certificados.</span>
        </div>
      </div>

      <div className="perfil-grid">
        <div>
          <label htmlFor="dc-telefono">Teléfono</label>
          <input id="dc-telefono" inputMode="tel" value={borrador.telefono} onChange={(e) => set('telefono', e.target.value)} />
          {/* Cuál de los dos es "el" teléfono no es una preferencia estética: este
              es el que sale impreso en el rótulo y el que usa el equipo para
              llamar. Cambiar de número es intercambiarlos. */}
          <span className="campo-ayuda">Es el que se imprime en el rótulo y por el que lo contactamos.</span>
        </div>
        <div>
          <label htmlFor="dc-telefono-alt">Teléfono alternativo</label>
          <input
            id="dc-telefono-alt"
            inputMode="tel"
            value={borrador.telefonoAlternativo}
            onChange={(e) => set('telefonoAlternativo', e.target.value)}
            placeholder="Segundo número, si tiene"
          />
          <span className="campo-ayuda">Respaldo, por si el primero no contesta.</span>
        </div>
        <div>
          <label htmlFor="dc-cargo">Cargo profesional</label>
          <select id="dc-cargo" value={borrador.cargo} onChange={(e) => set('cargo', e.target.value)}>
            <option value="">— Sin especificar —</option>
            {cargos.map((c) => (
              <option value={c.nombre} key={c.id}>
                {c.nombre}
              </option>
            ))}
            {borrador.cargo && !cargos.some((c) => c.nombre === borrador.cargo) && (
              <option value={borrador.cargo}>{borrador.cargo}</option>
            )}
          </select>
        </div>
      </div>

      <div className="perfil-grid">
        <div>
          <label htmlFor="dc-tipo-doc">Tipo de documento</label>
          <select id="dc-tipo-doc" value={borrador.tipoDocumento} onChange={(e) => set('tipoDocumento', e.target.value)}>
            <option value="DNI">DNI</option>
            <option value="CE">Carnet de extranjería</option>
            <option value="Pasaporte">Pasaporte</option>
          </select>
        </div>
        <div>
          <label htmlFor="dc-documento">Documento</label>
          <input id="dc-documento" value={borrador.documento} onChange={(e) => set('documento', e.target.value)} />
          {documentoVerificado && <span className="campo-ayuda">Verificado con RENIEC. Cámbialo solo si está mal.</span>}
        </div>
      </div>

      <div className="perfil-grid">
        <div>
          {/* Lista cerrada, igual que en el pedido de envío: el departamento
              decide la tarifa de courier y como texto libre no calzaba. */}
          <label htmlFor="dc-departamento">Departamento</label>
          <select id="dc-departamento" value={borrador.departamento} onChange={(e) => set('departamento', e.target.value)}>
            <option value="">— Sin especificar —</option>
            {DEPARTAMENTOS_PERU.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dc-distrito">Distrito</label>
          <input id="dc-distrito" value={borrador.distrito} onChange={(e) => set('distrito', e.target.value)} />
        </div>
      </div>

      <div className="perfil-grid">
        <div>
          <label htmlFor="dc-genero">Género</label>
          <select id="dc-genero" value={borrador.genero} onChange={(e) => set('genero', e.target.value)}>
            <option value="">— Sin especificar —</option>
            <option value="femenino">Femenino</option>
            <option value="masculino">Masculino</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label htmlFor="dc-nacimiento">Fecha de nacimiento</label>
          <input
            id="dc-nacimiento"
            type="date"
            value={borrador.fechaNacimiento}
            onChange={(e) => set('fechaNacimiento', e.target.value)}
          />
        </div>
      </div>

      <div className="fila" style={{ marginTop: '1rem' }}>
        <button className="btn" onClick={() => onGuardar(borrador)} disabled={guardando || !sucio}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button className="btn sec" type="button" onClick={cancelar} disabled={guardando}>
          Cancelar
        </button>
        {!sucio && <span className="campo-ayuda">No has cambiado nada todavía.</span>}
      </div>
    </section>
  );
}

function Dato({ etiqueta, valor, destacado = false }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div>
      <dt>{etiqueta}</dt>
      <dd className={valor ? (destacado ? 'destacado' : undefined) : 'vacio-dato'}>{valor || 'Sin registrar'}</dd>
    </div>
  );
}
