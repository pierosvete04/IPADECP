import type { ReactNode } from 'react';
import { Card, CardContent } from '@/Componentes/ui/card';
import { cn } from '@/lib/utils';

interface TableCardProps {
  title?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function TableCard({ title, badge, action, children, className }: TableCardProps) {
  return (
    <Card className={cn('min-w-0 overflow-hidden rounded-md p-0', className)}>
      {(title || badge || action) && (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
            {badge}
          </div>
          {action}
        </div>
      )}
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}
