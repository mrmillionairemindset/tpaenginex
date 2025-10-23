"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  type: "employer" | "provider";
  slug: string;
}

interface OrganizationSwitcherProps {
  currentOrg: Organization | null;
}

export function OrganizationSwitcher({ currentOrg }: OrganizationSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch all organizations the user belongs to
    const fetchOrganizations = async () => {
      try {
        const response = await fetch("/api/organizations");
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.organizations || []);
        }
      } catch (error) {
        console.error("Failed to fetch organizations:", error);
        // Fallback to current org if fetch fails
        if (currentOrg) {
          setOrganizations([currentOrg]);
        }
      }
    };

    fetchOrganizations();
  }, [currentOrg]);

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrg?.id) {
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/users/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });

      if (response.ok) {
        router.refresh();
        setOpen(false);
      }
    } catch (error) {
      console.error("Failed to switch organization:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!currentOrg) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
        <Building2 className="h-4 w-4" />
        <span>No organization</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        disabled={loading}
      >
        <Building2 className="h-4 w-4 text-gray-500" />
        <span className="max-w-[150px] truncate">{currentOrg.name}</span>
        <ChevronsUpDown className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-64 rounded-md border border-gray-200 bg-white shadow-lg">
            <div className="border-b border-gray-100 p-2">
              <p className="px-2 text-xs font-medium text-gray-500">
                Organizations
              </p>
            </div>
            <div className="py-1">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSwitch(org.id)}
                  className="flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{org.name}</p>
                      <p className="text-xs text-gray-500 capitalize">
                        {org.type}
                      </p>
                    </div>
                  </div>
                  {org.id === currentOrg.id && (
                    <Check className="h-4 w-4 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 p-2">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/organizations/new");
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4" />
                Create organization
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
