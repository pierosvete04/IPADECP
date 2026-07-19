import Link from 'next/link';
import LegalLayout from '@/Componentes/legal/LegalLayout';

export const metadata = { title: 'Política de privacidad — IPADECP' };

export default function PoliticaPrivacidadPage() {
  return (
    <LegalLayout titulo="Política de privacidad" fecha="Última actualización: junio de 2026">
      <p>
        En IPADECP recopilamos y tratamos tus datos personales únicamente para brindarte acceso a nuestros cursos y servicios del
        aula virtual, conforme a la Ley N.° 29733 de Protección de Datos Personales y su reglamento.
      </p>

      <h3>1. Datos que recopilamos</h3>
      <p>
        Nombres, apellidos, correo electrónico, teléfono, documento de identidad, fecha de nacimiento, departamento/distrito, y
        la información académica generada al usar la plataforma (inscripciones, notas, certificados, comprobantes de pago).
      </p>

      <h3>2. Finalidad del tratamiento</h3>
      <p>
        Usamos tus datos para: crear y administrar tu cuenta, darte acceso a los cursos contratados, emitir certificados,
        procesar pagos y verificar comprobantes, comunicarte avisos del curso, y atender consultas o reclamos.
      </p>

      <h3>3. Conservación y seguridad</h3>
      <p>
        Tus datos se almacenan en servidores con controles de acceso y cifrado en tránsito. Los conservamos mientras mantengas
        una cuenta activa o según lo exija la normativa aplicable.
      </p>

      <h3>4. Tus derechos</h3>
      <p>
        Puedes solicitar acceso, rectificación, cancelación u oposición (derechos ARCO) sobre tus datos personales escribiéndonos
        a través del <Link href="/reclamos">Libro de reclamaciones</Link> o al correo de contacto de IPADECP.
      </p>

      <h3>5. Encargados y terceros</h3>
      <p>
        Usamos proveedores de infraestructura (hosting, base de datos, pasarela de pagos) únicamente para operar la plataforma; no
        vendemos ni compartimos tus datos con fines publicitarios de terceros.
      </p>

      <h3>6. Cambios a esta política</h3>
      <p>
        Podemos actualizar esta política para reflejar mejoras del servicio o cambios normativos. La fecha de la última
        actualización se indica en la parte superior de esta página.
      </p>
    </LegalLayout>
  );
}
