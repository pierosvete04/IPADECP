'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase/client';
import { respaldarCertificadoEnDrive, urlCertificadoServidor } from '@/lib/certificado';
import { celebrar } from '@/lib/motion';

interface Certificado {
  id: number;
  codigo_verificacion: string;
  fecha: string;
  nota: number | null;
  registro: string | null;
  libro: string | null;
  creditos: string | null;
  meses: string | null;
  horas_lectivas: string | null;
  drive_digital_url: string | null;
}

export default function CertificadoBanner({
  cursoId,
  cursoNombre,
  userId,
  alumnoNombre,
  completadas,
  total,
}: {
  cursoId: number;
  cursoNombre: string;
  userId: string;
  alumnoNombre: string;
  completadas: number;
  total: number;
}) {
  const [certificado, setCertificado] = useState<Certificado | null | undefined>(undefined);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (certificado) celebrar(bannerRef.current, { icono: '[data-celebrar-icono]', resto: '[data-celebrar-item]' });
  }, [certificado]);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      const { data } = await supabase
        .from('certificados')
        .select('id,codigo_verificacion,fecha,nota,registro,libro,creditos,meses,horas_lectivas,drive_digital_url')
        .eq('curso_id', cursoId)
        .eq('alumno_uid', userId)
        .maybeSingle();
      if (!activo) return;

      if (!data && total > 0 && completadas >= total) {
        // Red de seguridad: si ya se completó todo pero el trigger no emitió (p.ej. datos previos a esta función), lo intentamos aquí.
        await supabase.rpc('intentar_emitir_certificado', { p_curso_id: cursoId, p_alumno_uid: userId });
        const { data: reintento } = await supabase
          .from('certificados')
          .select('id,codigo_verificacion,fecha,nota,registro,libro,creditos,meses,horas_lectivas,drive_digital_url')
          .eq('curso_id', cursoId)
          .eq('alumno_uid', userId)
          .maybeSingle();
        if (activo) setCertificado(reintento || null);
        return;
      }
      setCertificado(data || null);
    }
    cargar();
    return () => {
      activo = false;
    };
  }, [cursoId, userId, completadas, total]);

  useEffect(() => {
    if (!certificado) {
      setQrPreview(null);
      return;
    }
    let activo = true;
    QRCode.toDataURL(`${window.location.origin}/certificado/${certificado.codigo_verificacion}`, { margin: 1, width: 120 }).then((url) => {
      if (activo) setQrPreview(url);
    });
    return () => {
      activo = false;
    };
  }, [certificado]);

  // Respaldo en Drive la primera vez que el alumno ve su certificado. Va en segundo plano
  // y no se espera: lo que se descarga sale de /api/certificados/[codigo]/pdf, no de Drive.
  useEffect(() => {
    if (!certificado) return;
    respaldarCertificadoEnDrive('digital', certificado.id, certificado.drive_digital_url);
  }, [certificado]);

  if (certificado === undefined) return null;

  if (certificado) {
    return (
      <div
        className="aviso ok certificado-emitido"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
        ref={bannerRef}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '.8rem' }}>
          {qrPreview && (
            <img
              src={qrPreview}
              alt="QR del certificado"
              width={56}
              height={56}
              style={{ borderRadius: 6, background: '#fff' }}
              data-celebrar-icono
            />
          )}
          <span data-celebrar-item>🎓 ¡Certificado emitido! Completaste el 100% de tareas y exámenes del curso.</span>
        </span>
        <span style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }} data-celebrar-item>
          <a
            className="btn"
            href={urlCertificadoServidor(certificado.codigo_verificacion)}
            target="_blank"
            rel="noreferrer"
          >
            Descargar certificado (PDF)
          </a>
          <a className="btn sec" href="/aula?sec=certificado-fisico">
            Pedir copia física
          </a>
        </span>
      </div>
    );
  }

  if (total <= 0) return null;

  return (
    <div className="aviso info">
      Llevas <strong>{completadas}</strong> de <strong>{total}</strong> tareas/exámenes completados. Termina todos para obtener tu certificado con QR verificable.
    </div>
  );
}
