import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="aula-footer">
      <Link href="/politica-privacidad">Política de privacidad</Link>{' '}
      <Link href="/terminos-servicio">Términos del servicio</Link>{' '}
      <Link href="/politica-reembolso">Política de reembolso</Link>{' '}
      <Link href="/cookies">Cookies</Link>
    </footer>
  );
}
