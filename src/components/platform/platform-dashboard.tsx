'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Building2, Users, Plus } from 'lucide-react';
import Link from 'next/link';

interface TpaSummary {
  id: string;
  name: string;
  contactEmail: string | null;
  clientCount: number;
  userCount: number;
  isActive: boolean;
}

export function PlatformDashboard() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TpaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTenants() {
      try {
        const response = await fetch('/api/platform/tenants');
        if (response.ok) {
          const data = await response.json();
          setTenants(data.tenants || []);
        }
      } catch (error) {
        console.error('Failed to fetch tenants:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTenants();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const activeTpas = tenants.filter((t) => t.isActive).length;
  const totalClients = tenants.reduce((sum, t) => sum + t.clientCount, 0);
  const totalUsers = tenants.reduce((sum, t) => sum + t.userCount, 0);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6 flex items-center gap-4">
          <Building2 className="h-10 w-10 text-primary" />
          <div>
            <p className="text-3xl font-bold">{activeTpas}</p>
            <p className="text-sm text-muted-foreground">Active TPAs</p>
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4">
          <Building2 className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="text-3xl font-bold">{totalClients}</p>
            <p className="text-sm text-muted-foreground">Total Clients</p>
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4">
          <Users className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="text-3xl font-bold">{totalUsers}</p>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/platform/tenants/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New TPA Account
          </Button>
        </Link>
        <Link href="/platform/tenants">
          <Button variant="outline">View All TPA Accounts</Button>
        </Link>
      </div>

      {/* Recent TPAs */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">TPA Accounts</h2>
        {tenants.length === 0 ? (
          <p className="text-muted-foreground text-sm">No TPA accounts yet.</p>
        ) : (
          <div className="space-y-3">
            {tenants.map((tpa) => (
              <div
                key={tpa.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => router.push(`/platform/tenants/${tpa.id}`)}
              >
                <div>
                  <p className="font-medium">{tpa.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {tpa.clientCount} client{tpa.clientCount !== 1 ? 's' : ''} &middot; {tpa.userCount} user{tpa.userCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className={`text-xs font-medium px-2 py-1 rounded ${
                  tpa.isActive
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {tpa.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
