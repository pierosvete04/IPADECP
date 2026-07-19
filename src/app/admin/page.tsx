'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRequireAdmin } from '@/lib/supabase/auth';
import AdminShell from '@/Componentes/layout/AdminShell';
import DashboardSection from '@/Componentes/admin/DashboardSection';
import CategoriasSection from '@/Componentes/admin/CategoriasSection';
import CursosSection from '@/Componentes/admin/CursosSection';
import ModulosSection from '@/Componentes/admin/ModulosSection';
import MaterialesSection from '@/Componentes/admin/MaterialesSection';
import EvaluacionesSection from '@/Componentes/admin/EvaluacionesSection';
import EventosSection from '@/Componentes/admin/EventosSection';
import PromocionesSection from '@/Componentes/admin/PromocionesSection';
import MetodosPagoSection from '@/Componentes/admin/MetodosPagoSection';
import AlumnosSection from '@/Componentes/admin/AlumnosSection';
import GamificacionSection from '@/Componentes/admin/GamificacionSection';
import CodigosSection from '@/Componentes/admin/CodigosSection';
import CertificadosDirectosSection from '@/Componentes/admin/CertificadosDirectosSection';
import PeriodosCertificacionSection from '@/Componentes/admin/PeriodosCertificacionSection';
import CargosSection from '@/Componentes/admin/CargosSection';
import CuponesSection from '@/Componentes/admin/CuponesSection';
import VentasSection from '@/Componentes/admin/VentasSection';
import ReclamosSection from '@/Componentes/admin/ReclamosSection';

const SECCIONES: Record<string, React.ComponentType> = {
  dashboard: DashboardSection,
  categorias: CategoriasSection,
  cursos: CursosSection,
  modulos: ModulosSection,
  materiales: MaterialesSection,
  evaluaciones: EvaluacionesSection,
  eventos: EventosSection,
  promociones: PromocionesSection,
  metodospago: MetodosPagoSection,
  alumnos: AlumnosSection,
  gamificacion: GamificacionSection,
  codigos: CodigosSection,
  'certificados-directos': CertificadosDirectosSection,
  'periodos-certificacion': PeriodosCertificacionSection,
  cargos: CargosSection,
  cupones: CuponesSection,
  ventas: VentasSection,
  reclamos: ReclamosSection,
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
