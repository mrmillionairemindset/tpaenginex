import { ReactNode } from 'react';
import { Button } from './button';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  children?: ReactNode;
}

export function PageHeader({ title, description, action, children }: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div>
        {action && (
          <Button onClick={action.onClick}>
            {action.icon}
            {action.label}
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}
