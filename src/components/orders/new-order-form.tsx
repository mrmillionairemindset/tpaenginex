'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

interface ClientOrg {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

interface Collector {
  id: string;
  firstName: string;
  lastName: string;
}

interface NewOrderFormProps {
  orgId: string | null;
  userRole: string;
}

export function NewOrderForm({ orgId, userRole }: NewOrderFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientOrg[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const isTpaUser = userRole.startsWith('tpa_') || userRole === 'platform_admin';
  const canAssignCollector = userRole === 'tpa_admin' || userRole === 'tpa_staff' || userRole === 'platform_admin';
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    ssnLast4: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    testTypes: [] as string[],
    serviceType: 'pre_employment' as string,
    isDOT: false,
    priority: 'standard' as string,
    urgency: 'standard',
    jobsiteLocation: '',
    needsMask: 'no',
    maskSize: '',
    collectorId: '',
    notes: '',
  });

  useEffect(() => {
    // Fetch clients for TPA users
    if (isTpaUser) {
      const fetchClients = async () => {
        try {
          const response = await fetch('/api/clients');
          if (response.ok) {
            const data = await response.json();
            setClients(data.clients || []);
          }
        } catch (error) {
          console.error('Failed to fetch clients:', error);
        }
      };
      fetchClients();

      const fetchCollectors = async () => {
        try {
          const response = await fetch('/api/collectors');
          if (response.ok) {
            const data = await response.json();
            setCollectors(data.collectors || []);
          }
        } catch (error) {
          console.error('Failed to fetch collectors:', error);
        }
      };
      fetchCollectors();
    }
  }, [isTpaUser]);

  // Fetch locations when selected client changes
  useEffect(() => {
    if (!selectedClientId) {
      setLocations([]);
      setSelectedLocationId('');
      setUseCustomLocation(false);
      return;
    }

    const fetchClientLocations = async () => {
      try {
        const response = await fetch(`/api/clients/${selectedClientId}/locations`);
        if (response.ok) {
          const data = await response.json();
          setLocations(data.locations || []);
        }
      } catch (error) {
        console.error('Failed to fetch client locations:', error);
      }
    };
    fetchClientLocations();
    // Reset location selection when client changes
    setSelectedLocationId('');
    setUseCustomLocation(false);
    setFormData(prev => ({ ...prev, jobsiteLocation: '' }));
  }, [selectedClientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.testTypes.length === 0) {
      toast({ title: 'Please select at least one test type', variant: 'destructive' });
      return;
    }
    setLoading(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            dob: formData.dob,
            ssnLast4: formData.ssnLast4,
            email: formData.email,
            phone: formData.phone.replace(/\D/g, ''), // Strip formatting before sending
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
          },
          clientOrgId: selectedClientId || undefined,
          testType: formData.testTypes.join(', '),
          serviceType: formData.serviceType,
          isDOT: formData.isDOT,
          priority: formData.priority,
          urgency: formData.urgency,
          jobsiteLocation: formData.jobsiteLocation,
          needsMask: formData.needsMask === 'yes',
          maskSize: formData.needsMask === 'yes' ? formData.maskSize : undefined,
          collectorId: formData.collectorId || undefined,
          notes: formData.notes || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Order Created',
          description: `Order ${data.order.orderNumber} has been created successfully`,
        });
        router.push(`/orders/${data.order.id}`);
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to create order',
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
        {/* Client / Employer Selection */}
        {isTpaUser && clients.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Client / Employer</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="clientOrg">Client <span className="text-red-500">*</span></Label>
                <select
                  id="clientOrg"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  required
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  <option value="">Select a client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="clientLocation">Location</Label>
                {selectedClientId && locations.length > 0 ? (
                  <select
                    id="clientLocation"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={selectedLocationId || (useCustomLocation ? 'custom' : '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setUseCustomLocation(true);
                        setSelectedLocationId('');
                        setFormData(prev => ({ ...prev, jobsiteLocation: '' }));
                      } else {
                        setUseCustomLocation(false);
                        setSelectedLocationId(val);
                        const loc = locations.find(l => l.id === val);
                        if (loc) {
                          const parts = [loc.name];
                          const addr = [loc.address, loc.city, loc.state, loc.zip].filter(Boolean).join(', ');
                          if (addr) parts.push(addr);
                          setFormData(prev => ({ ...prev, jobsiteLocation: parts.join(' - ') }));
                        }
                      }
                    }}
                  >
                    <option value="">Select a location...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} — {loc.city}, {loc.state}
                      </option>
                    ))}
                    <option value="custom">Other (Enter manually)</option>
                  </select>
                ) : selectedClientId ? (
                  <p className="text-sm text-muted-foreground mt-2">No locations for this client. Enter jobsite below or add locations on the client page.</p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">Select a client first</p>
                )}
                {useCustomLocation && (
                  <Input
                    className="mt-2"
                    placeholder="Enter location manually..."
                    value={formData.jobsiteLocation}
                    onChange={(e) => setFormData({ ...formData, jobsiteLocation: e.target.value })}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold mb-4">Candidate Information</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
              <Input
                id="firstName"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
              <Input
                id="lastName"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dob">Date of Birth <span className="text-red-500">*</span></Label>
              <Input
                id="dob"
                required
                placeholder="MM/DD/YYYY"
                pattern="\d{2}/\d{2}/\d{4}"
                maxLength={10}
                value={formData.dob}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                  let formatted = digits;
                  if (digits.length >= 4) {
                    formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                  } else if (digits.length >= 2) {
                    formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                  }
                  setFormData({ ...formData, dob: formatted });
                }}
              />
            </div>
            <div>
              <Label htmlFor="ssnLast4">Last 4 Digits of SSN <span className="text-red-500">*</span></Label>
              <Input
                id="ssnLast4"
                required
                placeholder="1234"
                pattern="\d{4}"
                maxLength={4}
                value={formData.ssnLast4}
                onChange={(e) => setFormData({ ...formData, ssnLast4: e.target.value.replace(/\D/g, '') })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone <span className="text-red-500">*</span></Label>
              <Input
                id="phone"
                type="tel"
                required
                placeholder="555-123-4567"
                pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"
                maxLength={12}
                value={formData.phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  let formatted = digits;
                  if (digits.length >= 6) {
                    formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
                  } else if (digits.length >= 3) {
                    formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                  }
                  setFormData({ ...formData, phone: formatted });
                }}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address">Address <span className="text-red-500">*</span></Label>
              <Input
                id="address"
                required
                placeholder="123 Main Street"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="city">City <span className="text-red-500">*</span></Label>
              <Input
                id="city"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="state">State <span className="text-red-500">*</span></Label>
              <Select
                required
                value={formData.state}
                onValueChange={(value) => setFormData({ ...formData, state: value })}
              >
                <SelectTrigger id="state">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AL">Alabama</SelectItem>
                  <SelectItem value="AK">Alaska</SelectItem>
                  <SelectItem value="AZ">Arizona</SelectItem>
                  <SelectItem value="AR">Arkansas</SelectItem>
                  <SelectItem value="CA">California</SelectItem>
                  <SelectItem value="CO">Colorado</SelectItem>
                  <SelectItem value="CT">Connecticut</SelectItem>
                  <SelectItem value="DE">Delaware</SelectItem>
                  <SelectItem value="FL">Florida</SelectItem>
                  <SelectItem value="GA">Georgia</SelectItem>
                  <SelectItem value="HI">Hawaii</SelectItem>
                  <SelectItem value="ID">Idaho</SelectItem>
                  <SelectItem value="IL">Illinois</SelectItem>
                  <SelectItem value="IN">Indiana</SelectItem>
                  <SelectItem value="IA">Iowa</SelectItem>
                  <SelectItem value="KS">Kansas</SelectItem>
                  <SelectItem value="KY">Kentucky</SelectItem>
                  <SelectItem value="LA">Louisiana</SelectItem>
                  <SelectItem value="ME">Maine</SelectItem>
                  <SelectItem value="MD">Maryland</SelectItem>
                  <SelectItem value="MA">Massachusetts</SelectItem>
                  <SelectItem value="MI">Michigan</SelectItem>
                  <SelectItem value="MN">Minnesota</SelectItem>
                  <SelectItem value="MS">Mississippi</SelectItem>
                  <SelectItem value="MO">Missouri</SelectItem>
                  <SelectItem value="MT">Montana</SelectItem>
                  <SelectItem value="NE">Nebraska</SelectItem>
                  <SelectItem value="NV">Nevada</SelectItem>
                  <SelectItem value="NH">New Hampshire</SelectItem>
                  <SelectItem value="NJ">New Jersey</SelectItem>
                  <SelectItem value="NM">New Mexico</SelectItem>
                  <SelectItem value="NY">New York</SelectItem>
                  <SelectItem value="NC">North Carolina</SelectItem>
                  <SelectItem value="ND">North Dakota</SelectItem>
                  <SelectItem value="OH">Ohio</SelectItem>
                  <SelectItem value="OK">Oklahoma</SelectItem>
                  <SelectItem value="OR">Oregon</SelectItem>
                  <SelectItem value="PA">Pennsylvania</SelectItem>
                  <SelectItem value="RI">Rhode Island</SelectItem>
                  <SelectItem value="SC">South Carolina</SelectItem>
                  <SelectItem value="SD">South Dakota</SelectItem>
                  <SelectItem value="TN">Tennessee</SelectItem>
                  <SelectItem value="TX">Texas</SelectItem>
                  <SelectItem value="UT">Utah</SelectItem>
                  <SelectItem value="VT">Vermont</SelectItem>
                  <SelectItem value="VA">Virginia</SelectItem>
                  <SelectItem value="WA">Washington</SelectItem>
                  <SelectItem value="WV">West Virginia</SelectItem>
                  <SelectItem value="WI">Wisconsin</SelectItem>
                  <SelectItem value="WY">Wyoming</SelectItem>
                  <SelectItem value="DC">District of Columbia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="zip">ZIP Code <span className="text-red-500">*</span></Label>
              <Input
                id="zip"
                required
                placeholder="77777"
                pattern="\d{5}"
                maxLength={5}
                value={formData.zip}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value.replace(/\D/g, '').slice(0, 5) })}
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Order Details</h3>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="serviceType">Service Type <span className="text-red-500">*</span></Label>
                <select
                  id="serviceType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  required
                  value={formData.serviceType}
                  onChange={(e) => {
                    const serviceType = e.target.value;
                    const autoUrgent = serviceType === 'post_accident' || serviceType === 'reasonable_suspicion';
                    setFormData({
                      ...formData,
                      serviceType,
                      priority: autoUrgent ? 'urgent' : formData.priority,
                    });
                  }}
                >
                  <option value="pre_employment">Pre-Employment</option>
                  <option value="random">Random</option>
                  <option value="post_accident">Post-Accident</option>
                  <option value="reasonable_suspicion">Reasonable Suspicion</option>
                  <option value="physical">Physical</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="isDOT">DOT or Non-DOT <span className="text-red-500">*</span></Label>
                <div className="flex items-center gap-4 h-10">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isDOT"
                      checked={!formData.isDOT}
                      onChange={() => setFormData({ ...formData, isDOT: false })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium">Non-DOT</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isDOT"
                      checked={formData.isDOT}
                      onChange={() => setFormData({ ...formData, isDOT: true })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium">DOT</span>
                  </label>
                </div>
                {formData.isDOT && (
                  <p className="text-xs text-amber-600 mt-1">MRO notification step required for DOT orders</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option value="standard">Standard</option>
                  <option value="urgent">Urgent</option>
                </select>
                {formData.priority === 'urgent' && (
                  <span className="inline-block mt-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">URGENT</span>
                )}
              </div>

              <div>
                <Label>Test Type(s) <span className="text-red-500">*</span></Label>
                <div className="mt-2 space-y-2">
                  {['Pre-Employment Drug Screen', 'DOT Drug Test', 'Physical Examination', 'PPE Exam', 'PFT', 'RFT', 'Audiogram', 'TB Test', 'TB Gold Blood Test', 'Chest X-Ray with B Read', '10 Panel Urine Drug Screen', 'OSHA Questionnaire', 'Respirator Fit Test'].map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={formData.testTypes.includes(type)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...formData.testTypes, type]
                            : formData.testTypes.filter((t) => t !== type);
                          setFormData({ ...formData, testTypes: updated });
                        }}
                      />
                      <span className="text-sm">{type}</span>
                    </label>
                  ))}
                </div>
                {formData.testTypes.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Select at least one test type</p>
                )}
              </div>
            </div>

            {canAssignCollector && collectors.length > 0 && (
              <div>
                <Label htmlFor="collectorId">Assigned Collector</Label>
                <select
                  id="collectorId"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={formData.collectorId}
                  onChange={(e) => setFormData({ ...formData, collectorId: e.target.value })}
                >
                  <option value="">Select a collector...</option>
                  {collectors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label htmlFor="needsMask">Do you need a mask? <span className="text-red-500">*</span></Label>
              <select
                id="needsMask"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                required
                value={formData.needsMask}
                onChange={(e) => {
                  setFormData({ ...formData, needsMask: e.target.value, maskSize: e.target.value === 'no' ? '' : formData.maskSize });
                }}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            {formData.needsMask === 'yes' && (
              <div>
                <Label htmlFor="maskSize">What size? <span className="text-red-500">*</span></Label>
                <select
                  id="maskSize"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  required
                  value={formData.maskSize}
                  onChange={(e) => setFormData({ ...formData, maskSize: e.target.value })}
                >
                  <option value="">Select size...</option>
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                  <option value="X-Large">X-Large</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
            )}

            {/* Jobsite Location — only show manual entry if no client/location selected above */}
            {(!isTpaUser || clients.length === 0) && (
              <div>
                <Label htmlFor="jobsiteLocation">Jobsite Location <span className="text-red-500">*</span></Label>
                <Input
                  id="jobsiteLocation"
                  required
                  placeholder="e.g., Main Office - 123 Business St, City, State"
                  value={formData.jobsiteLocation}
                  onChange={(e) => setFormData({ ...formData, jobsiteLocation: e.target.value })}
                />
              </div>
            )}

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any special instructions or requirements"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Order'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </Card>
    </form>
  );
}
