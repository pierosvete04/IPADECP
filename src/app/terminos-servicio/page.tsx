import Link from 'next/link';
import LegalLayout from '@/Componentes/legal/LegalLayout';

export const metadata = { title: 'Términos del servicio — IPADECP' };

export default function TerminosServicioPage() {
  return (
    <LegalLayout titulo="Términos del servicio" fecha="Última actualización: junio de 2026">
      <p>Al crear una cuenta o acceder a los cursos de IPADECP aceptas los siguientes términos.</p>

      <h3>1. El servicio</h3>
      <p>
        IPADECP ofrece cursos de capacitación en salud en modalidad 100% en línea, a través de esta aula virtual. El acceso a
        cada curso se activa tras la confirmación del pago o el canje de un código de acceso.
      </p>

      <h3>2. Tu cuenta</h3>
      <p>
        Eres responsable de mantener la confidencialidad de tu contraseña y de la información que registras en tu perfil. Cada
        cuenta es de uso personal e intransferible.
      </p>

      <h3>3. Uso de los cursos</h3>
      <p>
        El contenido (videos, materiales, presentaciones, evaluaciones) es para tu uso personal de aprendizaje. No está
        permitido reproducirlo, distribuirlo ni compartir tus credenciales de acceso con terceros.
      </p>

      <h3>4. Evaluaciones y certificados</h3>
      <p>
        Cada curso puede incluir tareas autoevaluables, exámenes y tareas entregables. El certificado se emite cuando el
        promedio del curso alcanza la nota mínima requerida (14/20), según las reglas de intentos definidas para cada
        evaluación.
      </p>

      <h3>5. Pagos</h3>
      <p>
        Los precios se muestran en soles (S/) al momento de la compra. El acceso se activa de forma inmediata cuando el pago se
        realiza con tarjeta, o tras la verificación del comprobante cuando el pago es por transferencia o Yape. Consulta
        nuestra <Link href="/politica-reembolso">Política de reembolso</Link>.
      </p>

      <h3>6. Conducta del usuario</h3>
      <p>
        No está permitido usar la plataforma para fines distintos a la capacitación, intentar vulnerar su seguridad, ni
        suplantar a otra persona.
      </p>

      <h3>7. Limitación de responsabilidad</h3>
      <p>
        IPADECP pone a tu disposición el contenido educativo con fines formativos; no sustituye la consulta, criterio o
        supervisión profesional en el ejercicio clínico real.
      </p>

      <h3>8. Cambios</h3>
      <p>
        Podemos actualizar estos términos. Si los cambios son sustanciales, te lo comunicaremos a través del aula virtual o tu
        correo registrado.
      </p>
    </LegalLayout>
  );
}
