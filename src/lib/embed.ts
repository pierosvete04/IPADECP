// Convierte un enlace de YouTube o Google Drive/Docs en su URL embebible.
export function embed(url: string | null | undefined): string {
  if (!url) return '';
  if (url.includes('youtube') || url.includes('youtu.be')) {
    // Extrae el ID sea cual sea el formato: youtu.be/ID, watch?v=ID, /embed/ID, /shorts/ID
    const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
    const id = m ? m[1] : '';
    return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : url;
  }
  if (url.includes('drive.google') || url.includes('docs.google')) {
    return url.replace('/view', '/preview').replace('/edit', '/preview');
  }
  return url;
}

// Un documento de Drive trae su propia barra de navegación de páginas/zoom, a
// diferencia del video, donde se recorta el chrome de Drive/YouTube.
export function esDocumento(url: string | null | undefined): boolean {
  return !!url && (url.includes('drive.google') || url.includes('docs.google')) && !url.includes('youtube');
}
