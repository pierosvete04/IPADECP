import Link from 'next/link';
import LegalLayout from '@/Componentes/legal/LegalLayout';

export const metadata = { title: 'Política de reembolso — IPADECP' };

export default function PoliticaReembolsoPage() {
  return (
    <LegalLayout titulo="Política de reembolso" fecha="Última actualización: junio de 2026">
      <p>Como nuestros cursos son contenido digital de acceso inmediato, esta política define cuándo procede un reembolso.</p>

      <h3>1. Plazo para solicitar reembolso</h3>
      <p>
        Puedes solicitar el reembolso de un curso dentro de las <strong>48 horas</strong> posteriores a la activación de tu
        acceso, siempre que no hayas completado más del 20% de su contenido (módulos vistos, materiales descargados o
        evaluaciones rendidas).
      </p>

      <h3>2. Casos que no aplican a reembolso</h3>
      <p>
        No procede el reembolso cuando: ya rendiste una evaluación o examen del curso, descargaste el certificado, o el código de
        acceso fue canjeado hace más de 48 horas.
      </p>

      <h3>3. Pagos por transferencia o Yape/Plin</h3>
      <p>
        Si tu pago aún está pendiente de verificación y decides no continuar con la compra, escríbenos antes de que se confirme
        el acceso para anular el pedido sin costo.
      </p>

      <h3>4. Cómo solicitarlo</h3>
      <p>
        Escríbenos a través del <Link href="/reclamos">Libro de reclamaciones</Link> indicando el curso, la fecha de compra y el
        motivo. Evaluaremos tu solicitud y te responderemos en un plazo máximo de 5 días hábiles.
      </p>

      <h3>5. Forma de devolución</h3>
      <p>El reembolso aprobado se realiza por el mismo medio de pago utilizado en la compra original.</p>
    </LegalLayout>
  );
}
