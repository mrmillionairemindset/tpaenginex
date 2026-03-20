"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, Mail, Shield, Building2, Trash2, AlertTriangle, UserMinus, MapPin, Plus, Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Organization {
  id: string;
  name: string;
  type: "platform" | "tpa" | "client";
  slug: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  isActive: boolean;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    lastLoginAt: string | null;
  };
  invitedBy: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

interface Location {
  id: string;
  orgId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

interface OrganizationSettingsProps {
  organization: Organization;
  currentUser: User;
}

export function OrganizationSettings({ organization, currentUser }: OrganizationSettingsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"general" | "members" | "invitations" | "locations">("general");
  const [orgName, setOrgName] = useState(organization.name);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [locationForm, setLocationForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    notes: "",
  });

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Organization updated successfully" });
      } else {
        setMessage({ type: "error", text: "Failed to update organization" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
          orgId: organization.id,
        }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Invitation sent successfully" });
        setInviteName("");
        setInviteEmail("");
        setInviteRole("");
        fetchMembers(); // Refresh members list
      } else {
        const data = await response.json();
        setMessage({ type: "error", text: data.error || "Failed to send invitation" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrganization = async () => {
    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Redirect to dashboard after successful deletion
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await response.json();
        setMessage({ type: "error", text: data.error || "Failed to delete organization" });
        setShowDeleteDialog(false);
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred while deleting" });
      setShowDeleteDialog(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const fetchMembers = async () => {
    setMembersLoading(true);
    try {
      const response = await fetch(`/api/organizations/${organization.id}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/organizations/${organization.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberToRemove.userId }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Member removed successfully" });
        setMemberToRemove(null);
        fetchMembers(); // Refresh the list
      } else {
        const data = await response.json();
        setMessage({ type: "error", text: data.error || "Failed to remove member" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    setLocationsLoading(true);
    try {
      const response = await fetch(`/api/organizations/${organization.id}/locations`);
      if (response.ok) {
        const data = await response.json();
        setLocations(data.locations || []);
      }
    } catch (error) {
      console.error("Failed to fetch locations:", error);
    } finally {
      setLocationsLoading(false);
    }
  };

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const url = `/api/organizations/${organization.id}/locations`;
      const method = editingLocation ? "PATCH" : "POST";
      const body = editingLocation
        ? { locationId: editingLocation.id, ...locationForm }
        : locationForm;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: editingLocation ? "Location updated successfully" : "Location added successfully",
        });
        setShowLocationForm(false);
        setEditingLocation(null);
        setLocationForm({ name: "", address: "", city: "", state: "", zip: "", phone: "", notes: "" });
        fetchLocations();
      } else {
        const data = await response.json();
        setMessage({ type: "error", text: data.error || "Failed to save location" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!locationToDelete) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/organizations/${organization.id}/locations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: locationToDelete.id }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Location deleted successfully" });
        setLocationToDelete(null);
        fetchLocations();
      } else {
        const data = await response.json();
        setMessage({ type: "error", text: data.error || "Failed to delete location" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setLocationForm({
      name: location.name,
      address: location.address,
      city: location.city,
      state: location.state,
      zip: location.zip,
      phone: location.phone || "",
      notes: location.notes || "",
    });
    setShowLocationForm(true);
  };

  useEffect(() => {
    // Fetch members and locations once when component mounts
    fetchMembers();
    fetchLocations();
  }, []);

  const roleOptions = organization.type === "tpa"
    ? [
        { value: "tpa_admin", label: "Admin" },
        { value: "tpa_staff", label: "Staff" },
        { value: "tpa_records", label: "Records" },
        { value: "tpa_billing", label: "Billing" },
      ]
    : [
        { value: "client_admin", label: "Client Admin" },
      ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === "general"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Building2 className="h-5 w-5" />
            General
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === "members"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Users className="h-5 w-5" />
            Members
          </button>
          <button
            onClick={() => setActiveTab("invitations")}
            className={`flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === "invitations"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Mail className="h-5 w-5" />
            Add Member
          </button>
          <button
            onClick={() => setActiveTab("locations")}
            className={`flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === "locations"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <MapPin className="h-5 w-5" />
            Locations
          </button>
        </nav>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-md p-4 ${
            message.type === "success" ? "bg-green-50" : "bg-red-50"
          }`}
        >
          <p
            className={`text-sm font-medium ${
              message.type === "success" ? "text-green-800" : "text-red-800"
            }`}
          >
            {message.text}
          </p>
        </div>
      )}

      {/* General Settings */}
      {activeTab === "general" && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Organization Information
          </h2>
          <form onSubmit={handleUpdateOrg} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Organization Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full rounded-md border-0 px-3 py-2 text-foreground ring-1 ring-inset ring-input focus:ring-2 focus:ring-ring sm:text-sm"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Organization Type
              </label>
              <input
                type="text"
                value={organization.type}
                className="w-full rounded-md border-0 px-3 py-2 text-muted-foreground ring-1 ring-inset ring-input bg-muted sm:text-sm capitalize"
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Slug
              </label>
              <input
                type="text"
                value={organization.slug}
                className="w-full rounded-md border-0 px-3 py-2 text-muted-foreground ring-1 ring-inset ring-input bg-muted sm:text-sm"
                disabled
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </form>

          {/* Danger Zone */}
          <div className="mt-8 pt-8 border-t border-border">
            <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Danger Zone
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete an organization, there is no going back. This action cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Organization
            </button>
          </div>
        </div>
      )}

      {/* Members */}
      {activeTab === "members" && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Organization Members ({members.length})
          </h2>

          {membersLoading ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Loading members...</p>
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-4">
              No members found. Invite users via the Invitations tab.
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                      {member.user.name?.[0]?.toUpperCase() || member.user.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                          {member.user.name || "No name"}
                        </p>
                        {member.userId === currentUser.id && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            You
                          </span>
                        )}
                        {(member.role === "tpa_admin" || member.role === "platform_admin") && (
                          <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{member.user.email}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </span>
                        {member.user.lastLoginAt && (
                          <span>
                            Last login {new Date(member.user.lastLoginAt).toLocaleDateString()}
                          </span>
                        )}
                        {!member.user.lastLoginAt && (
                          <span className="text-amber-600">Never logged in</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {member.userId !== currentUser.id && (
                    <button
                      onClick={() => setMemberToRemove(member)}
                      className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove member"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Member */}
      {activeTab === "invitations" && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Add New Member
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Create the user identity, assign a role, and send them an invite to log in.
          </p>
          <form onSubmit={handleInviteUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Smith"
                required
                className="w-full rounded-md border-0 px-3 py-2 text-foreground ring-1 ring-inset ring-input focus:ring-2 focus:ring-ring sm:text-sm"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="jane@company.com"
                required
                className="w-full rounded-md border-0 px-3 py-2 text-foreground ring-1 ring-inset ring-input focus:ring-2 focus:ring-ring sm:text-sm"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                required
                className="w-full rounded-md border-0 px-3 py-2 text-foreground ring-1 ring-inset ring-input focus:ring-2 focus:ring-ring sm:text-sm"
                disabled={loading}
              >
                <option value="">Select a role...</option>
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Creating & Sending Invite..." : "Create User & Send Invite"}
            </button>
          </form>
        </div>
      )}

      {/* Locations */}
      {activeTab === "locations" && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Locations ({locations.length})
            </h2>
            {!showLocationForm && (
              <button
                onClick={() => {
                  setShowLocationForm(true);
                  setEditingLocation(null);
                  setLocationForm({ name: "", address: "", city: "", state: "", zip: "", phone: "", notes: "" });
                }}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Add Location
              </button>
            )}
          </div>

          {showLocationForm && (
            <form onSubmit={handleLocationSubmit} className="mb-6 space-y-4 rounded-lg border p-4 bg-muted">
              <h3 className="font-medium text-foreground">
                {editingLocation ? "Edit Location" : "Add New Location"}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Location Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={locationForm.name}
                    onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                    placeholder="e.g., Main Office, Warehouse 3"
                    className="w-full rounded-md border-0 px-3 py-2 text-foreground ring-1 ring-inset ring-input focus:ring-2 focus:ring-ring sm:text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={locationForm.address}
                    onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                    placeholder="123 Main Street"
                    className="w-full rounded-md border-0 px-3 py-2 text-foreground ring-1 ring-inset ring-input focus:ring-2 focus:ring-ring sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={locationForm.city}
                    onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
                    className="w-full rounded-md border-0 px-3 py-2 text-foreground ring-1 ring-inset ring-input focus:ring-2 focus:ring-ring sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={locationForm.state}
                    onChange={(e) => setLocationForm({ ...locationForm, state: e.target.value })}
                    className="w-full rounded-md border-0 px-3 py-2 text-foreground ring-1 ring-inset ring-input focus:ring-2 focus:ring-ring sm:text-sm"
                  >
                    <option value="">Select state</option>
                    <option value="AL">AL - Alabama</option>
                    <option value="AK">AK - Alaska</option>
                    <option value="AZ">AZ - Arizona</option>
                    <option value="AR">AR - Arkansas</option>
                    <option value="CA">CA - California</option>
                    <option value="CO">CO - Colorado</option>
                    <option value="CT">CT - Connecticut</option>
                    <option value="DE">DE - Delaware</option>
                    <option value="FL">FL - Florida</option>
                    <option value="GA">GA - Georgia</option>
                    <option value="HI">HI - Hawaii</option>
                    <option value="ID">ID - Idaho</option>
                    <option value="IL">IL - Illinois</option>
                    <option value="IN">IN - Indiana</option>
                    <option value="IA">IA - Iowa</option>
                    <option value="KS">KS - Kansas</option>
                    <option value="KY">KY - Kentucky</option>
                    <option value="LA">LA - Louisiana</option>
                    <option value="ME">ME - Maine</option>
                    <option value="MD">MD - Maryland</option>
                    <option value="MA">MA - Massachusetts</option>
                    <option value="MI">MI - Michigan</option>
                    <option value="MN">MN - Minnesota</option>
                    <option value="MS">MS - Mississippi</option>
                    <option value="MO">MO - Missouri</option>
                    <option value="MT">MT - Montana</option>
                    <option value="NE">NE - Nebraska</option>
                    <option value="NV">NV - Nevada</option>
                    <option value="NH">NH - New Hampshire</option>
                    <option value="NJ">NJ - New Jersey</option>
                    <option value="NM">NM - New Mexico</option>
                    <option value="NY">NY - New York</option>
                    <option value="NC">NC - North Carolina</option>
                    <option value="ND">ND - North Dakota</option>
                    <option value="OH">OH - Ohio</option>
                    <option value="OK">OK - Oklahoma</option>
                    <option value="OR">OR - Oregon</option>
                    <option value="PA">PA - Pennsylvania</option>
                    <option value="RI">RI - Rhode Island</option>
                    <option value="SC">SC - South Carolina</option>
                    <option value="SD">SD - South Dakota</option>
                    <option value="TN">TN - Tennessee</option>
                    <option value="TX">TX - Texas</option>
                    <option value="UT">UT - Utah</option>
                    <option value="VT">VT - Vermont</option>
                    <option value="VA">VA - Virginia</option>
                    <option value="WA">WA - Washington</option>
                    <option value="WV">WV - West Virginia</option>
                    <option value="WI">WI - Wisconsin</option>
                    <option value="WY">WY - Wyoming</option>
                    <option value="DC">DC - District of Columbia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    ZIP Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="77777"
                    pattern="\d{5}"
                    maxLength={5}
                    value={locationForm.zip}
                    onChange={(e) => setLocationForm({ ...locationForm, zip: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                    className="w-full rounded-md border-0 px-3 py-2 text-foreground ring-1 ring-inset ring-input focus:ring-2 focus:ring-ring sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="555-123-4567"
                    pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"
                    maxLength={12}
                    value={locationForm.phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      let formatted = digits;
                      if (digits.length >= 6) {
                        formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
                      } else if (digits.length >= 3) {
                        formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                      }
                      setLocationForm({ ...locationForm, phone: formatted });
                    }}
                    className="w-full rounded-md border-0 px-3 py-2 text-foreground ring-1 ring-inset ring-input focus:ring-2 focus:ring-ring sm:text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Notes
                  </label>
                  <textarea
                    value={locationForm.notes}
                    onChange={(e) => setLocationForm({ ...locationForm, notes: e.target.value })}
                    rows={2}
                    placeholder="Additional notes about this location..."
                    className="w-full rounded-md border-0 px-3 py-2 text-foreground ring-1 ring-inset ring-input focus:ring-2 focus:ring-ring sm:text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? "Saving..." : editingLocation ? "Update Location" : "Add Location"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationForm(false);
                    setEditingLocation(null);
                    setLocationForm({ name: "", address: "", city: "", state: "", zip: "", phone: "", notes: "" });
                  }}
                  className="rounded-md border border-input px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {locationsLoading ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Loading locations...</p>
            </div>
          ) : locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No locations added yet. Click "Add Location" to add your first location.
            </p>
          ) : (
            <div className="space-y-3">
              {locations.map((location) => (
                <div
                  key={location.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">{location.name}</h4>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {location.address}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {location.city}, {location.state} {location.zip}
                      </p>
                      {location.phone && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Phone: {location.phone}
                        </p>
                      )}
                      {location.notes && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          {location.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEditLocation(location)}
                      className="p-2 text-primary hover:bg-primary/5 rounded transition-colors"
                      title="Edit location"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setLocationToDelete(location)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete location"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Organization Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete Organization
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{organization.name}</strong>?
              <br /><br />
              This action cannot be undone. This will permanently delete the organization
              and remove all associated data.
              {organization.type === "client" && (
                <>
                  <br /><br />
                  <strong className="text-red-600">Warning:</strong> This will only work if the organization has no orders or candidates.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrganization}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteLoading ? "Deleting..." : "Delete Organization"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-red-600" />
              Remove Member
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{memberToRemove?.user.name || memberToRemove?.user.email}</strong> from {organization.name}?
              <br /><br />
              They will lose access to this organization and all its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {loading ? "Removing..." : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Location Confirmation Dialog */}
      <AlertDialog open={!!locationToDelete} onOpenChange={(open) => !open && setLocationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Delete Location
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{locationToDelete?.name}</strong>?
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLocation}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {loading ? "Deleting..." : "Delete Location"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
