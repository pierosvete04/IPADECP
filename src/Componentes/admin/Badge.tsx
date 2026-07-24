const COLORES = {
  verde: 'bg-green-100 text-green-700',
  naranja: 'bg-orange-100 text-orange-700',
  rojo: 'bg-red-100 text-red-700',
  gris: 'bg-gray-200 text-gray-600',
  azul: 'bg-blue-100 text-blue-700',
  celeste: 'bg-sky-100 text-sky-700',
} as const;

export type BadgeColor = keyof typeof COLORES;

interface BadgeProps {
  color: BadgeColor;
  children: React.ReactNode;
}

export function Badge({ color, children }: BadgeProps) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${COLORES[color]}`}>{children}</span>;
}
