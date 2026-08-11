'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { verificarDni } from '@/lib/dni';
import { resolverCuentaCliente } from '@/lib/certificadosDirectos';
import { Button } from '@/Componentes/ui/button';
import { Input } from '@/Componentes/ui/input';
import { Label } from '@/Componentes/ui/label';
import type { PerfilCliente } from '@/lib/pedidos';
import Aviso from '@/Componentes/ui/Aviso';

/** Datos de acceso de la cuenta que se acaba de crear (o reutilizar) para el cliente. */
export interface CuentaResuelta {
  email?: string;
  passwordTemporal?: string;
  yaExistia?: boolean;
}

interface ClienteSelectorProps {
  value: PerfilCliente | null;
  onChange: (cliente: PerfilCliente | null) => void;
  /**
   * Se dispara al resolver la cuenta de un cliente nuevo. El formulario padre
   * lo usa para mostrar el correo y la contraseña temporal — solo se ven una
   * vez, así que si no se muestran, se pierden.
   */
  onCuentaResuelta?: (cuenta: CuentaResuelta | null) => void;
}

export function ClienteSelector({ value, onChange, onCuentaResuelta }: ClienteSelectorProps) {
  const [modo, setModo] = useState<'buscar' | 'nuevo'>('buscar');

  if (value) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">{value.nombre || 'Sin nombre'}</p>
          <p className="text-xs text-muted-foreground">{value.email}</p>
          {value.telefono && <p className="text-xs text-muted-foreground">{value.telefono}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(null);
            onCuentaResuelta?.(null);
          }}
        >
          <X className="h-4 w-4" /> Cambiar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-md bg-muted p-1">
        <button
          type="button"
          onClick={() => setModo('buscar')}
          className={`flex-1 rounded px-2 py-1 text-xs font-medium ${modo === 'buscar' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
        >
          Cliente existente
        </button>
        <button
          type="button"
          onClick={() => setModo('nuevo')}
          className={`flex-1 rounded px-2 py-1 text-xs font-medium ${modo === 'nuevo' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
        >
          Cliente nuevo
        </button>
      </div>

      {modo === 'buscar' ? <BuscarExistente onChange={onChange} /> : <CrearCliente onChange={onChange} onCuentaResuelta={onCuentaResuelta} />}
    </div>
  );
}

function BuscarExistente({ onChange }: { onChange: (cliente: PerfilCliente) => void }) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<PerfilCliente[]>([]);
  const busquedaDebounced = useDebounce(busqueda, 300);

  useEffect(() => {
    let cancelado = false;
    async function buscar() {
      const termino = busquedaDebounced.trim();
      if (termino.length < 2) {
        setResultados([]);
        return;
      }
      const { data } = await supabase
        .from('perfiles')
        .select('id,nombre,email,telefono')
        .neq('rol', 'admin')
        .or(`nombre.ilike.%${termino}%,email.ilike.%${termino}%,documento.ilike.%${termino}%`)
        .limit(8);
      if (!cancelado) setResultados((data as PerfilCliente[]) ?? []);
    }
    buscar();
    return () => {
      cancelado = true;
    };
  }, [busquedaDebounced]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Busca por nombre, correo o DNI…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>
      {resultados.length > 0 && (
        <div className="flex flex-col gap-1">
          {resultados.map((c) => (
            <button key={c.id} type="button" onClick={() => onChange(c)} className="rounded-md p-2 text-left text-sm hover:bg-muted">
              <span className="font-medium">{c.nombre || 'Sin nombre'}</span>
              <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Alta de un cliente que todavía no tiene cuenta, sin salir del pedido. Es el
 * mismo camino que usa Certificados directos (`resolverCuentaCliente`): si el
 * DNI ya está registrado se reutiliza esa cuenta en vez de duplicarla, y si no,
 * se crea vía la Edge Function admin-crear-usuario.
 *
 * Por qué el DNI y no el nombre: buscar por nombre deja crear dos veces al
 * mismo cliente sin darte cuenta ("Juan Perez" / "Juan Pérez"). El DNI es la
 * clave real — `perfiles.documento` — y además RENIEC devuelve el nombre ya
 * escrito como figura en el registro, que es el que debe salir impreso.
 */
function CrearCliente({
  onChange,
  onCuentaResuelta,
}: {
  onChange: (cliente: PerfilCliente) => void;
  onCuentaResuelta?: (cuenta: CuentaResuelta | null) => void;
}) {
  const [dni, setDni] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correoContacto, setCorreoContacto] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);

  async function verificarConReniec() {
    if (!/^\d{8}$/.test(dni)) {
      setAviso({ texto: 'Ingresa un DNI válido de 8 dígitos.', tipo: 'err' });
      return;
    }
    setVerificando(true);
    setAviso(null);
    const res = await verificarDni(dni, '');
    setVerificando(false);
    if (res.ok && res.nombreCompleto) {
      setNombreCompleto(res.nombreCompleto);
      setAviso({ texto: `Nombre encontrado en RENIEC: ${res.nombreCompleto}`, tipo: 'ok' });
    } else {
      setAviso({ texto: res.motivo || 'No se pudo verificar el DNI en RENIEC. Ingresa el nombre manualmente.', tipo: 'err' });
    }
  }

  async function crear() {
    if (!/^\d{8}$/.test(dni)) {
      setAviso({ texto: 'Ingresa un DNI válido de 8 dígitos.', tipo: 'err' });
      return;
    }
    if (!nombreCompleto.trim()) {
      setAviso({ texto: 'Ingresa el nombre completo del cliente.', tipo: 'err' });
      return;
    }
    setCreando(true);
    setAviso(null);
    const res = await resolverCuentaCliente({
      dni,
      nombreCompleto,
      cargo: '',
      telefono: telefono.trim() || undefined,
      correoContacto: correoContacto.trim() || undefined,
    });
    setCreando(false);

    if (!res.ok || !res.alumnoUid) {
      setAviso({ texto: res.motivo || 'No se pudo crear la cuenta del cliente.', tipo: 'err' });
      return;
    }

    onCuentaResuelta?.({ email: res.email, passwordTemporal: res.passwordTemporal, yaExistia: res.yaExistia });
    onChange({
      id: res.alumnoUid,
      nombre: nombreCompleto.trim(),
      email: res.email ?? null,
      telefono: telefono.trim() || null,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Aviso tipo={aviso?.tipo ?? 'err'} mensaje={aviso?.texto} />

      <div className="flex flex-col gap-1.5">
        <Label>DNI</Label>
        <div className="fila">
          <Input value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="8 dígitos" style={{ maxWidth: 130 }} />
          <Button type="button" variant="outline" size="sm" onClick={verificarConReniec} disabled={verificando}>
            {verificando ? 'Verificando…' : 'RENIEC'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Nombre completo</Label>
        <Input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} placeholder="Nombres y apellidos" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Teléfono (opcional)</Label>
        <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Correo de contacto (opcional)</Label>
        <Input type="email" value={correoContacto} onChange={(e) => setCorreoContacto(e.target.value)} placeholder="correo real del cliente" />
      </div>

      <Button type="button" onClick={crear} disabled={creando}>
        {creando ? 'Creando cuenta…' : 'Crear cuenta y usar'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Si el DNI ya tiene cuenta, se reutiliza. Si no, se genera un correo <code>@ipadecp.com.pe</code> y una contraseña temporal que tendrás que
        entregarle al cliente.
      </p>
    </div>
  );
}
