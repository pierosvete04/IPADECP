'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useRequireSession } from '@/lib/supabase/auth';
import AulaShell from '@/Componentes/layout/AulaShell';
import type { SeccionAula } from '@/Componentes/layout/Topbar';
import InicioTab from '@/Componentes/aula/InicioTab';
import MisCursosTab from '@/Componentes/aula/MisCursosTab';
import ComprarTab from '@/Componentes/aula/ComprarTab';
import PerfilTab from '@/Componentes/aula/PerfilTab';
import CodigoModal from '@/Componentes/aula/CodigoModal';
import DatosObligatoriosModal from '@/Componentes/aula/DatosObligatoriosModal';
import HistorialList from '@/Componentes/aula/HistorialList';

interface PerfilInicial {
  nombre?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
  fecha_nacimiento?: string | null;
  telefono?: string | null;
  email?: string | null;
}

function AulaContenido() {
  const { user, loading } = useRequireSession();
  const searchParams = useSearchParams();
  const sec = (searchParams.get('sec') as SeccionAula) || 'inicio';

  const [perfil, setPerfil] = useState<PerfilInicial | null>(null);
  const [nombre, setNombre] = useState('');
  const [pedirDatos, setPedirDatos] = useState(false);
  const [codigoAbierto, setCodigoAbierto] = useState(false);
  const [misCursosKey, setMisCursosKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let activo = true;
    supabase
      .from('perfiles')
      .select('nombre,nombres,apellidos,fecha_nacimiento,email,telefono,documento,avatar_key')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!activo) return;
        setPerfil(data);
        setNombre(data?.nombre || user.email || '');
        if (data && (!data.nombres || !data.apellidos || !data.fecha_nacimiento)) {
          setPedirDatos(true);
        }
      });
    return () => {
      activo = false;
    };
  }, [user]);

  if (loading || !user) return null;

  return (
    <AulaShell user={user} activeSec={sec}>
      {sec === 'inicio' && <InicioTab userId={user.id} nombre={nombre} />}
      {sec === 'cursos' && <MisCursosTab key={misCursosKey} userId={user.id} onAbrirCodigo={() => setCodigoAbierto(true)} />}
      {sec === 'comprar' && <ComprarTab user={user} onFinalizado={() => setMisCursosKey((k) => k + 1)} />}
      {sec === 'perfil' && <PerfilTab user={user} onPerfilActualizado={setNombre} />}
      {sec === 'historial' && (
        <>
          <h2 className="titulo">Historial de compras</h2>
          <HistorialList userId={user.id} />
        </>
      )}

      <CodigoModal
        open={codigoAbierto}
        onClose={() => setCodigoAbierto(false)}
        onCanjeado={() => {
          setCodigoAbierto(false);
          setMisCursosKey((k) => k + 1);
        }}
      />
      <DatosObligatoriosModal
        open={pedirDatos}
        perfil={perfil}
        userId={user.id}
        onGuardado={(n) => {
          setNombre(n);
          setPedirDatos(false);
        }}
      />
    </AulaShell>
  );
}

export default function AulaPage() {
  return (
    <Suspense fallback={null}>
      <AulaContenido />
    </Suspense>
  );
}
