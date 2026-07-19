import { embed, esDocumento } from '@/lib/embed';

export interface CursoDetalle {
  id: number;
  nombre: string | null;
  introduccion1: string | null;
  seccion3_link: string | null;
  enlace_clase_vivo: string | null;
  tipo_curso: string | null;
}

export default function InformacionTab({ curso }: { curso: CursoDetalle }) {
  const esPremium = curso.tipo_curso === 'premium';
  const claseVivo = esPremium && curso.enlace_clase_vivo;

  const bannerPremium = claseVivo && (
    <div className="clase-vivo">
      <div>
        <span className="tag-premium-inline">
          <span className="material-symbols-outlined" style={{ fontSize: 13, verticalAlign: '-2px' }}>
            star
          </span>{' '}
          Curso Premium
        </span>{' '}
        Este curso incluye clases sincrónicas en vivo.
      </div>
      <a className="btn" target="_blank" rel="noreferrer" href={curso.enlace_clase_vivo!}>
        Unirme a la clase en vivo
      </a>
    </div>
  );

  if (!curso.seccion3_link && !curso.introduccion1) {
    return bannerPremium || <p className="vacio">Sin información general.</p>;
  }

  const esDoc = esDocumento(curso.seccion3_link);

  return (
    <div className={`visor-layout${esDoc ? ' con-documento' : ''}`}>
      <div className="descripcion">
        {bannerPremium}
        {curso.introduccion1 ? (
          <div className="card card-pad" style={{ whiteSpace: 'pre-line' }}>
            {curso.introduccion1}
          </div>
        ) : (
          <p className="vacio">Sin descripción.</p>
        )}
      </div>
      {curso.seccion3_link && (
        <div className={`visor-caja${esDoc ? ' documento' : ''}`}>
          <iframe src={embed(curso.seccion3_link)} allowFullScreen />
        </div>
      )}
    </div>
  );
}
