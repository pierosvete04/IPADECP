export const PALETA_CURSO = [
  'linear-gradient(135deg,#0b6683,#073a4c)',
  'linear-gradient(135deg,#2f6bd6,#173f86)',
  'linear-gradient(135deg,#0c9e7a,#066b52)',
  'linear-gradient(135deg,#e8772a,#b85a16)',
  'linear-gradient(135deg,#7c5cff,#4a32b0)',
  'linear-gradient(135deg,#c2851a,#8a5e0f)',
  'linear-gradient(135deg,#3fe0b0,#0c9e7a)',
  'linear-gradient(135deg,#d6336c,#8a1f47)',
];

const STOPWORDS_CURSO = new Set(['y', 'de', 'en', 'la', 'el', 'los', 'las', 'del', 'al', 'a', 'para', 'con']);

export function monogramaCurso(nombre: string | null | undefined): string {
  const palabras = (nombre || '').trim().split(/\s+/).filter((w) => w && !STOPWORDS_CURSO.has(w.toLowerCase()));
  const letras = palabras.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
  return letras || (nombre || '?').charAt(0).toUpperCase();
}

export function degradadoCurso(id: number | null | undefined): string {
  return PALETA_CURSO[(id || 0) % PALETA_CURSO.length];
}
