import { degradadoCurso, monogramaCurso } from '@/lib/course-art';

export default function CourseArt({ id, nombre, img }: { id?: number | null; nombre?: string | null; img?: string | null }) {
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />;
  }
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: degradadoCurso(id),
        color: '#fff',
        fontWeight: 700,
        fontFamily: 'var(--st-font-titulo)',
        letterSpacing: '.5px',
      }}
    >
      {monogramaCurso(nombre)}
    </div>
  );
}
