import LegalLayout from '@/Componentes/legal/LegalLayout';

export const metadata = { title: 'Política de cookies — IPADECP' };

export default function CookiesPage() {
  return (
    <LegalLayout titulo="Política de cookies" fecha="Última actualización: junio de 2026">
      <p>
        Esta página explica qué cookies y tecnologías similares (como el almacenamiento local del navegador) usa IPADECP en su
        aula virtual.
      </p>

      <h3>1. Cookies esenciales / de sesión</h3>
      <p>
        Usamos cookies y almacenamiento local estrictamente necesarios para mantener tu sesión iniciada mientras navegas por el
        aula virtual (por ejemplo, el token de autenticación de tu cuenta). Sin ellas no podrías acceder a tus cursos.
      </p>

      <h3>2. Cookies de preferencia</h3>
      <p>Pueden usarse para recordar configuraciones simples de tu experiencia en la plataforma, como la última pestaña visitada.</p>

      <h3>3. Lo que NO hacemos</h3>
      <p>No utilizamos cookies de publicidad ni de rastreo de terceros para fines comerciales.</p>

      <h3>4. Cómo controlar las cookies</h3>
      <p>
        Puedes borrar o bloquear las cookies desde la configuración de tu navegador. Ten en cuenta que si bloqueas las cookies
        esenciales, no podrás iniciar sesión en el aula virtual.
      </p>
    </LegalLayout>
  );
}
