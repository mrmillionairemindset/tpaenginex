'use client';

import { useState } from 'react';
import { LayoutGrid, Table2 } from 'lucide-react';
import { OrdersTable } from './orders-table';
import { OrdersKanban } from './orders-kanban';

interface OrdersViewToggleProps {
  userRole: string;
}

export function OrdersViewToggle({ userRole }: OrdersViewToggleProps) {
  const [view, setView] = useState<'table' | 'board'>('table');

  return (
    <div>
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setView('table')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            view === 'table'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          <Table2 className="h-4 w-4" />
          Table
        </button>
        <button
          onClick={() => setView('board')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            view === 'board'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Board
        </button>
      </div>

      {view === 'table' ? (
        <OrdersTable userRole={userRole} />
      ) : (
        <OrdersKanban userRole={userRole} />
      )}
    </div>
  );
}
