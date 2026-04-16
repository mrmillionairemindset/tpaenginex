'use client';

import { useCallback, useEffect, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { PackageFormDialog } from './package-form-dialog';
import { useToast } from '@/components/ui/use-toast';

interface Package {
  id: string;
  name: string;
  description: string | null;
  provider: string;
  providerPackageSlug: string;
  includesMvr: boolean;
  includesDrugTest: boolean;
  includesEmploymentVerification: boolean;
  includesEducationVerification: boolean;
  retailPriceCents: number;
  isActive: boolean;
}

export function PackagesTable() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Package | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/background/packages?includeInactive=true');
      if (res.ok) {
        const data = await res.json();
        setRows(data.packages || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this package? Existing checks will still reference it.')) return;
    const res = await fetch(`/api/background/packages/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Package deactivated' });
      fetchData();
    } else {
      toast({ title: 'Error', description: 'Failed to deactivate', variant: 'destructive' });
    }
  };

  const columns = [
    {
      header: 'Name',
      accessor: (r: Package) => (
        <div>
          <div className="font-medium">{r.name}</div>
          {r.description && (
            <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{r.description}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Provider',
      accessor: (r: Package) => r.provider,
    },
    {
      header: 'Slug',
      accessor: (r: Package) => <span className="font-mono text-xs">{r.providerPackageSlug}</span>,
    },
    {
      header: 'Includes',
      accessor: (r: Package) => {
        const flags: string[] = [];
        if (r.includesMvr) flags.push('MVR');
        if (r.includesDrugTest) flags.push('Drug');
        if (r.includesEmploymentVerification) flags.push('Emp');
        if (r.includesEducationVerification) flags.push('Edu');
        return flags.length > 0 ? flags.join(', ') : '-';
      },
    },
    {
      header: 'Price',
      accessor: (r: Package) => `$${(r.retailPriceCents / 100).toFixed(2)}`,
    },
    {
      header: 'Status',
      accessor: (r: Package) =>
        r.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
    },
    {
      header: 'Actions',
      accessor: (r: Package) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(r);
              setDialogOpen(true);
            }}
          >
            Edit
          </Button>
          {r.isActive && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(r.id);
              }}
            >
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Package
        </Button>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        emptyMessage="No background check packages yet. Create one to offer checks to clients."
      />

      <PackageFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pkg={editing}
        onSaved={() => {
          setDialogOpen(false);
          fetchData();
        }}
      />
    </>
  );
}
