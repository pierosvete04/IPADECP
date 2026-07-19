'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from 'recharts';
import { CreditCard, TrendingUp, UserPlus, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import Avatar from '@/Componentes/ui/Avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Componentes/ui/card';
import { Badge } from '@/Componentes/ui/badge';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/Componentes/ui/chart';

const TABLAS: [string, string][] = [
  ['cursos', 'Cursos'],
  ['categorias', 'Categorías'],
  ['modulos', 'Módulos'],
  ['materiales', 'Materiales'],
  ['tareas', 'Tareas/Exámenes'],
  ['inscripciones', 'Inscripciones'],
  ['codigos_acceso', 'Códigos'],
  ['reclamos', 'Reclamos'],
];

const METODO_LABEL: Record<string, string> = { mercadopago: 'Tarjeta (Mercado Pago)', transferencia: 'Transferencia', yape_plin: 'Yape/Plin', pendiente: 'Sin definir' };

interface VentaFila {
  monto: number | null;
  metodo: string | null;
  fecha: string | null;
  estado: string | null;
}

interface ClienteNuevo {
  id: string;
  nombre: string | null;
  email: string | null;
  creado_en: string | null;
  documento_verificado: boolean | null;
  avatar_key?: string | null;
}

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fmtSoles(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function hace(fecha: string | null): string {
  if (!fecha) return '—';
  const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return `hace ${meses} mes${meses > 1 ? 'es' : ''}`;
}

export default function DashboardSection() {
  const [counts, setCounts] = useState<number[] | null>(null);
  const [ventas, setVentas] = useState<VentaFila[] | null>(null);
  const [clientesNuevos, setClientesNuevos] = useState<ClienteNuevo[] | null>(null);
  const [nuevos30, setNuevos30] = useState<number | null>(null);
  const [mesesBase, setMesesBase] = useState<{ key: string; mes: string }[] | null>(null);

  useEffect(() => {
    let activo = true;
    Promise.all(TABLAS.map(([t]) => supabase.from(t).select('id', { count: 'exact', head: true }))).then((rs) => {
      if (activo) setCounts(rs.map((r) => r.count ?? 0));
    });
    supabase
      .from('ventas')
      .select('monto,metodo,fecha,estado')
      .then(({ data }) => {
        if (activo) setVentas((data as VentaFila[]) || []);
      });
    supabase
      .from('perfiles')
      .select('id,nombre,email,creado_en,documento_verificado,avatar_key')
      .neq('rol', 'admin')
      .order('creado_en', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (activo) setClientesNuevos((data as ClienteNuevo[]) || []);
      });

    // "Ahora" solo se lee acá (dentro del efecto, no en render) para no violar
    // la regla de pureza de React: el KPI de alumnos nuevos se cuenta contra
    // toda la tabla (gte en el servidor), no solo contra los 6 que se listan.
    const hoy = new Date();
    const hace30Iso = new Date(hoy.getTime() - 30 * 86400000).toISOString();
    supabase
      .from('perfiles')
      .select('id', { count: 'exact', head: true })
      .neq('rol', 'admin')
      .gte('creado_en', hace30Iso)
      .then(({ count }) => {
        if (activo) setNuevos30(count ?? 0);
      });

    const meses: { key: string; mes: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      meses.push({ key: `${d.getFullYear()}-${d.getMonth()}`, mes: MESES_ES[d.getMonth()] });
    }
    setMesesBase(meses);

    return () => {
      activo = false;
    };
  }, []);

  const aprobadas = useMemo(() => (ventas || []).filter((v) => v.estado === 'aprobado'), [ventas]);

  const kpis = useMemo(() => {
    const ingresos = aprobadas.reduce((acc, v) => acc + Number(v.monto || 0), 0);
    const pendientes = (ventas || []).filter((v) => v.estado === 'pendiente').length;
    return { ingresos, ventasAprobadas: aprobadas.length, pendientes };
  }, [aprobadas, ventas]);

  // Ingresos aprobados de los últimos 6 meses, agrupados por mes calendario.
  const ventasPorMes = useMemo(() => {
    if (!mesesBase) return [];
    const meses = mesesBase.map((m) => ({ ...m, ingresos: 0 }));
    for (const v of aprobadas) {
      if (!v.fecha) continue;
      const d = new Date(v.fecha);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = meses.find((m) => m.key === key);
      if (bucket) bucket.ingresos += Number(v.monto || 0);
    }
    return meses;
  }, [aprobadas, mesesBase]);

  const ventasPorMetodo = useMemo(() => {
    const colores: Record<string, string> = { mercadopago: 'var(--chart-1)', transferencia: 'var(--chart-2)', yape_plin: 'var(--chart-3)', pendiente: 'var(--chart-4)' };
    const totales = new Map<string, number>();
    for (const v of aprobadas) {
      const m = v.metodo || 'pendiente';
      totales.set(m, (totales.get(m) || 0) + Number(v.monto || 0));
    }
    return [...totales.entries()]
      .map(([metodo, monto]) => ({ metodo, label: METODO_LABEL[metodo] || metodo, monto, fill: colores[metodo] || 'var(--chart-5)' }))
      .sort((a, b) => b.monto - a.monto);
  }, [aprobadas]);

  const chartConfigMes: ChartConfig = { ingresos: { label: 'Ingresos', color: 'var(--chart-1)' } };
  const chartConfigMetodo: ChartConfig = Object.fromEntries(ventasPorMetodo.map((m) => [m.metodo, { label: m.label, color: m.fill }]));

  return (
    <>
      <h1 className="titulo">Inicio</h1>

      {/* KPIs de ventas */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Wallet className="size-3.5" /> Ingresos totales
            </CardDescription>
            <CardTitle className="text-2xl">{ventas === null ? '…' : fmtSoles(kpis.ingresos)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="size-3.5" /> Ventas aprobadas
            </CardDescription>
            <CardTitle className="text-2xl">{ventas === null ? '…' : kpis.ventasAprobadas}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <CreditCard className="size-3.5" /> Ventas pendientes
            </CardDescription>
            <CardTitle className="text-2xl">
              {ventas === null ? '…' : kpis.pendientes}
              {kpis.pendientes > 0 && (
                <Badge variant="outline" className="ml-2 align-middle text-[10px]">
                  por revisar
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <UserPlus className="size-3.5" /> Alumnos nuevos (30d)
            </CardDescription>
            <CardTitle className="text-2xl">{nuevos30 === null ? '…' : nuevos30}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Dashboard de ventas + método de pago + clientes nuevos */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ventas de los últimos 6 meses</CardTitle>
            <CardDescription>Ingresos aprobados por mes</CardDescription>
          </CardHeader>
          <CardContent>
            {ventas === null ? (
              <p className="vacio">Cargando…</p>
            ) : (
              <ChartContainer config={chartConfigMes} className="aspect-auto h-[220px] w-full">
                <BarChart data={ventasPorMes}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtSoles(Number(v))} />} />
                  <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ventas por método de pago</CardTitle>
            <CardDescription>Del total de ventas aprobadas</CardDescription>
          </CardHeader>
          <CardContent>
            {ventas === null ? (
              <p className="vacio">Cargando…</p>
            ) : !ventasPorMetodo.length ? (
              <p className="vacio">Aún no hay ventas aprobadas.</p>
            ) : (
              <>
                <ChartContainer config={chartConfigMetodo} className="mx-auto aspect-square max-h-[180px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(v) => fmtSoles(Number(v))} />} />
                    <Pie data={ventasPorMetodo} dataKey="monto" nameKey="label" innerRadius={45} strokeWidth={4}>
                      {ventasPorMetodo.map((m) => (
                        <Cell key={m.metodo} fill={m.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {ventasPorMetodo.map((m) => (
                    <li key={m.metodo} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="inline-block size-2.5 rounded-[2px]" style={{ backgroundColor: m.fill }} />
                        {m.label}
                      </span>
                      <span className="font-mono font-medium">{fmtSoles(m.monto)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Clientes nuevos</CardTitle>
          <CardDescription>Últimas cuentas registradas en el aula</CardDescription>
        </CardHeader>
        <CardContent>
          {clientesNuevos === null ? (
            <p className="vacio">Cargando…</p>
          ) : !clientesNuevos.length ? (
            <p className="vacio">Aún no hay cuentas registradas.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {clientesNuevos.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Avatar avatarKey={c.avatar_key} nombreRef={c.nombre || c.email} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.nombre || '—'}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.email}</div>
                  </div>
                  {c.documento_verificado && (
                    <Badge variant="secondary" className="shrink-0">
                      verificado
                    </Badge>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">{hace(c.creado_en)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <h2 className="titulo mt-6" style={{ fontSize: '1.1rem' }}>
        Contenido de la plataforma
      </h2>
      <div className="stat-grid">
        {counts === null
          ? 'Cargando…'
          : TABLAS.map(([, label], i) => (
              <div className="stat" key={label}>
                <div className="n">{counts[i]}</div>
                <div className="l">{label}</div>
              </div>
            ))}
      </div>
    </>
  );
}
