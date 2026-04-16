'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { AlertCircle, Building2, Users, FileText, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface OrganizationDetailsProps {
  organizationId: string;
}

export function OrganizationDetails({ organizationId }: OrganizationDetailsProps) {
  const [organization, setOrganization] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrganization() {
      try {
        const response = await fetch(`/api/organizations/${organizationId}`);
        if (response.ok) {
          const data = await response.json();
          setOrganization(data.organization);
        } else {
          setError('Organization not found');
        }
      } catch (err) {
        setError('Failed to load organization');
      } finally {
        setLoading(false);
      }
    }

    fetchOrganization();
  }, [organizationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !organization) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Organization Not Found"
        description={error || 'The organization you are looking for does not exist'}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{organization.name}</h1>
        <p className="text-muted-foreground mt-1 capitalize">{organization.type} Organization</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Organization Information */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Organization Information</h2>
          </div>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-muted-foreground">Organization Name</dt>
              <dd className="font-medium">{organization.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Type</dt>
              <dd className="font-medium capitalize">{organization.type}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Slug</dt>
              <dd className="font-medium">{organization.slug}</dd>
            </div>
            {organization.contactEmail && (
              <div>
                <dt className="text-sm text-muted-foreground">Contact Email</dt>
                <dd className="font-medium">{organization.contactEmail}</dd>
              </div>
            )}
            {organization.contactPhone && (
              <div>
                <dt className="text-sm text-muted-foreground">Contact Phone</dt>
                <dd className="font-medium">{organization.contactPhone}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className="font-medium">{organization.isActive ? 'Active' : 'Inactive'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Member Since</dt>
              <dd className="font-medium">{format(new Date(organization.createdAt), 'PPP')}</dd>
            </div>
          </dl>
        </Card>

        {/* Statistics */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Statistics</h2>
          </div>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-muted-foreground">Total Orders</dt>
              <dd className="font-medium text-2xl">{organization._count?.orders || 0}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Total Persons</dt>
              <dd className="font-medium text-2xl">{organization._count?.persons || 0}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Total Users</dt>
              <dd className="font-medium text-2xl">{organization._count?.users || 0}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Address */}
      {organization.address && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Address</h2>
          </div>
          <p className="text-foreground">
            {organization.address}
            {organization.city && `, ${organization.city}`}
            {organization.state && `, ${organization.state}`}
            {organization.zip && ` ${organization.zip}`}
          </p>
        </Card>
      )}
    </div>
  );
}
