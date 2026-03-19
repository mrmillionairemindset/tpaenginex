'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

export function NewTenantForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    contactEmail: '',
    contactPhone: '',
    adminEmail: '',
    adminName: '',
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/platform/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          contactEmail: formData.contactEmail || undefined,
          contactPhone: formData.contactPhone || undefined,
          adminEmail: formData.adminEmail,
          adminName: formData.adminName,
        }),
      });

      if (response.ok) {
        toast({
          title: 'TPA Created',
          description: `${formData.name} has been provisioned successfully`,
        });
        router.push('/platform/tenants');
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to create TPA tenant',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">TPA Organization</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="name">
                Organization Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData({
                    ...formData,
                    name,
                    slug: formData.slug === generateSlug(formData.name)
                      ? generateSlug(name)
                      : formData.slug,
                  });
                }}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="slug">
                URL Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="slug"
                required
                placeholder="my-tpa-org"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, ''),
                  })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>
            <div>
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) =>
                  setFormData({ ...formData, contactEmail: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) =>
                  setFormData({ ...formData, contactPhone: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Initial Admin User</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="adminName">
                Admin Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="adminName"
                required
                value={formData.adminName}
                onChange={(e) =>
                  setFormData({ ...formData, adminName: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="adminEmail">
                Admin Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="adminEmail"
                type="email"
                required
                value={formData.adminEmail}
                onChange={(e) =>
                  setFormData({ ...formData, adminEmail: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Provisioning...' : 'Provision TPA'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </Card>
    </form>
  );
}
