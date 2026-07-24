'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRequireAdmin } from '@/lib/supabase/auth';
import AdminShell from '@/Componentes/layout/AdminShell';
import SeccionSkeleton from '@/Componentes/admin/SeccionSkeleton';

// Cada sección es su propio chunk: entrar al panel ya no descarga de una
// las 21 pantallas (con recharts, gsap, jspdf, jszip, xlsx, qrcode
// incluidos) solo para mostrar el Dashboard. Cada una se pide recién cuando
// el admin la visita, mostrando SeccionSkeleton mientras llega.
const DashboardSection = dynamic(() => import('@/Componentes/admin/DashboardSection'), { loading: SeccionSkeleton });
const CategoriasSection = dynamic(() => import('@/Componentes/admin/CategoriasSection'), { loading: SeccionSkeleton });
const CursosSection = dynamic(() => import('@/Componentes/admin/CursosSection'), { loading: SeccionSkeleton });
const EventosSection = dynamic(() => import('@/Componentes/admin/EventosSection'), { loading: SeccionSkeleton });
const PromocionesSection = dynamic(() => import('@/Componentes/admin/PromocionesSection'), { loading: SeccionSkeleton });
const MetodosPagoSection = dynamic(() => import('@/Componentes/admin/MetodosPagoSection'), { loading: SeccionSkeleton });
const AlumnosSection = dynamic(() => import('@/Componentes/admin/AlumnosSection'), { loading: SeccionSkeleton });
const ClientesSection = dynamic(() => import('@/Componentes/admin/ClientesSection'), { loading: SeccionSkeleton });
const GamificacionSection = dynamic(() => import('@/Componentes/admin/GamificacionSection'), { loading: SeccionSkeleton });
const CodigosSection = dynamic(() => import('@/Componentes/admin/CodigosSection'), { loading: SeccionSkeleton });
const VentaAsistidaSection = dynamic(() => import('@/Componentes/admin/VentaAsistidaSection'), { loading: SeccionSkeleton });
const CertificadosDirectosSection = dynamic(() => import('@/Componentes/admin/CertificadosDirectosSection'), { loading: SeccionSkeleton });
const CertificadosEmitidosSection = dynamic(() => import('@/Componentes/admin/CertificadosEmitidosSection'), { loading: SeccionSkeleton });
const CertificadosClientesSection = dynamic(() => import('@/Componentes/admin/CertificadosClientesSection'), { loading: SeccionSkeleton });
const DisenoCertificadoSection = dynamic(() => import('@/Componentes/admin/DisenoCertificadoSection'), { loading: SeccionSkeleton });
const PeriodosCertificacionSection = dynamic(() => import('@/Componentes/admin/PeriodosCertificacionSection'), { loading: SeccionSkeleton });
const CargosSection = dynamic(() => import('@/Componentes/admin/CargosSection'), { loading: SeccionSkeleton });
const CuponesSection = dynamic(() => import('@/Componentes/admin/CuponesSection'), { loading: SeccionSkeleton });
const PedidosSection = dynamic(() => import('@/Componentes/admin/PedidosSection'), { loading: SeccionSkeleton });
const ReclamosSection = dynamic(() => import('@/Componentes/admin/ReclamosSection'), { loading: SeccionSkeleton });
const TarifasEnvioCertificadoSection = dynamic(() => import('@/Componentes/admin/TarifasEnvioCertificadoSection'), { loading: SeccionSkeleton });

const SECCIONES: Record<string, React.ComponentType> = {
  dashboard: DashboardSection,
  categorias: CategoriasSection,
  cursos: CursosSection,
  eventos: EventosSection,
  promociones: PromocionesSection,
  metodospago: MetodosPagoSection,
  alumnos: AlumnosSection,
  clientes: ClientesSection,
  'certificados-clientes': CertificadosClientesSection,
  gamificacion: GamificacionSection,
  'ventas-asistidas': VentaAsistidaSection,
  codigos: CodigosSection,
  'certificados-directos': CertificadosDirectosSection,
  'certificados-emitidos': CertificadosEmitidosSection,
  'diseno-certificado': DisenoCertificadoSection,
  'periodos-certificacion': PeriodosCertificacionSection,
  cargos: CargosSection,
  cupones: CuponesSection,
  pedidos: PedidosSection,
  reclamos: ReclamosSection,
  'tarifas-envio-certificado': TarifasEnvioCertificadoSection,
};

function AdminContenido() {
  const { user, loading } = useRequireAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activo = searchParams.get('sec') && SECCIONES[searchParams.get('sec')!] ? searchParams.get('sec')! : 'dashboard';

  if (loading || !user) return null;

  const Seccion = SECCIONES[activo];

  return (
    <AdminShell user={user} activo={activo} onSelect={(key) => router.push(`/admin?sec=${key}`)}>
      <Seccion />
    </AdminShell>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminContenido />
    </Suspense>
  );
}
