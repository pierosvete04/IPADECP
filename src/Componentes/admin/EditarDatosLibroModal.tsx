'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import { sugerirSiguienteCodigo } from '@/lib/certificado';
import Modal from '@/Componentes/ui/Modal';

export interface DatosLibroCertificado {
  id: number;
  registro: string | null;
  libro: string | null;
  creditos: string | null;
  meses: string | null;
  horas_lectivas: string | null;
}

/** Modal compartido para editar los datos de "libros y registros académicos" (Registro N°, Libro N°,
 * créditos, meses, horas lectivas) de un certificado ya emitido — se guardan una sola vez y no se
 * recalculan solos, porque certificados de fechas atrasadas no siempre siguen el mismo orden.
 * Usado tanto por Certificados emitidos como por Certificados de clientes (misma tabla `certificados`). */
export default function EditarDatosLibroModal({
  fila,
  existentes,
  onClose,
  onGuardado,
}: {
  fila: DatosLibroCertificado | null;
  existentes: DatosLibroCertificado[];
  onClose: () => void;
  onGuardado: (fila: DatosLibroCertificado) => void;
}) {
  const [registro, setRegistro] = useState('');
  const [libro, setLibro] = useState('');
  const [creditos, setCreditos] = useState('');
  const [meses, setMeses] = useState('');
  const [horasLectivas, setHorasLectivas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!fila) return;
    setAviso(null);
    setRegistro(fila.registro || sugerirSiguienteCodigo(existentes.map((f) => f.registro)));
    setLibro(fila.libro || sugerirSiguienteCodigo(existentes.map((f) => f.libro)));
    setCreditos(fila.creditos || '');
    setMeses(fila.meses || '');
    setHorasLectivas(fila.horas_lectivas || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fila?.id]);

  async function guardar() {
    if (!fila) return;
    setGuardando(true);
    setAviso(null);
    const cambios = { registro: registro || null, libro: libro || null, creditos: creditos || null, meses: meses || null, horas_lectivas: horasLectivas || null };
    const { error } = await supabase.from('certificados').update(cambios).eq('id', fila.id);
    setGuardando(false);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado({ ...fila, ...cambios });
    onClose();
  }

  return (
    <Modal open={!!fila} title="Datos de libros y registros académicos" onClose={onClose}>
      <p className="sub" style={{ marginTop: 0 }}>
        Registro N° y Libro N° se sugieren a partir del último usado, pero puedes cambiarlos — útil cuando este
        certificado es de una fecha atrasada y no debe romper el orden de los ya emitidos.
      </p>
      <div className="perfil-grid">
        <div>
          <label>Registro N°</label>
          <input value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder="Ej. 008116" />
        </div>
        <div>
          <label>Libro N°</label>
          <input value={libro} onChange={(e) => setLibro(e.target.value)} placeholder="Ej. 08116" />
        </div>
      </div>
      <div className="perfil-grid" style={{ marginTop: '.6rem' }}>
        <div>
          <label>Créditos académicos</label>
          <input value={creditos} onChange={(e) => setCreditos(e.target.value)} placeholder="Ej. 30" />
        </div>
        <div>
          <label>Meses de estudio</label>
          <input value={meses} onChange={(e) => setMeses(e.target.value)} placeholder="Ej. 06" />
        </div>
      </div>
      <label style={{ marginTop: '.6rem' }}>Horas lectivas</label>
      <input value={horasLectivas} onChange={(e) => setHorasLectivas(e.target.value)} placeholder="Ej. 480" />

      {aviso && <div className="aviso err" style={{ marginTop: '.6rem' }}>{aviso}</div>}
      <button className="btn bloque" onClick={guardar} disabled={guardando} type="button">
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </Modal>
  );
}
