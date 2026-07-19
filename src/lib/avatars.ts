export interface AvatarDef {
  key: string;
  nombre: string;
  foto: string;
}

export const AVATARS_DISPONIBLES: AvatarDef[] = [
  { key: 'avatar_1', nombre: 'Enfermera', foto: '/img/avatares/avatar-1-enfermera.jpeg' },
  { key: 'avatar_2', nombre: 'Est. medicina', foto: '/img/avatares/avatar-2-estudiante-medicina.jpeg' },
  { key: 'avatar_3', nombre: 'Enfermera sr.', foto: '/img/avatares/avatar-3-enfermera-experiencia.jpeg' },
  { key: 'avatar_4', nombre: 'Lab. clínico', foto: '/img/avatares/avatar-4-tecnico-laboratorio.jpeg' },
  { key: 'avatar_5', nombre: 'Obstetricia', foto: '/img/avatares/avatar-5-estudiante-obstetricia.jpeg' },
  { key: 'avatar_6', nombre: 'Paramédico', foto: '/img/avatares/avatar-6-paramedico.jpeg' },
  { key: 'avatar_7', nombre: 'Doctora', foto: '/img/avatares/avatar-7-doctora-mayor.jpeg' },
  { key: 'avatar_8', nombre: 'Salud pública', foto: '/img/avatares/avatar-8-estudiante-salud-publica.jpeg' },
  { key: 'avatar_9', nombre: 'Farmacia', foto: '/img/avatares/avatar-9-tecnica-farmacia.jpeg' },
  { key: 'avatar_10', nombre: 'Cuid. intensivos', foto: '/img/avatares/avatar-10-enfermero-cuidados-intensivos.jpeg' },
];

export function avatarPorKey(key: string | null | undefined): AvatarDef | undefined {
  return AVATARS_DISPONIBLES.find((a) => a.key === key);
}
