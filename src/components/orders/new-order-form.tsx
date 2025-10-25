'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InfoIcon } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

interface NewOrderFormProps {
  orgId: string | null;
}

export function NewOrderForm({ orgId }: NewOrderFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [useCustomLocation, setUseCustomLocation] = useState(false);
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
    testType: 'Pre-Employment Drug Screen',
    urgency: 'standard',
    jobsiteLocation: '',
    useConcentra: 'yes',
    needsMask: 'no',
    maskSize: '',
    notes: '',
  });

  useEffect(() => {
    // Fetch user's organization locations
    const fetchLocations = async () => {
      if (!orgId) return;

      try {
        const response = await fetch(`/api/organizations/${orgId}/locations`);
        if (response.ok) {
          const data = await response.json();
          setLocations(data.locations || []);
        }
      } catch (error) {
        console.error('Failed to fetch locations:', error);
      }
    };

    fetchLocations();
  }, [orgId]);

  const handleLocationSelect = (locationId: string) => {
    if (locationId === 'custom') {
      setUseCustomLocation(true);
      setSelectedLocationId('');
      setFormData({ ...formData, jobsiteLocation: '' });
    } else {
      setUseCustomLocation(false);
      setSelectedLocationId(locationId);
      const location = locations.find(loc => loc.id === locationId);
      if (location) {
        // Build location string, only including fields that have values
        const parts = [location.name];

        if (location.address || location.city || location.state || location.zip) {
          const addressParts = [];
          if (location.address) addressParts.push(location.address);
          if (location.city) addressParts.push(location.city);
          if (location.state) addressParts.push(location.state);
          if (location.zip) addressParts.push(location.zip);

          if (addressParts.length > 0) {
            parts.push(addressParts.join(', '));
          }
        }

        setFormData({
          ...formData,
          jobsiteLocation: parts.join(' - '),
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          testType: formData.testType,
          urgency: formData.urgency,
          jobsiteLocation: formData.jobsiteLocation,
          useConcentra: formData.useConcentra === 'yes',
          needsMask: formData.needsMask === 'yes',
          maskSize: formData.needsMask === 'yes' ? formData.maskSize : undefined,
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
            <div>
              <Label htmlFor="testType">Test Type <span className="text-red-500">*</span></Label>
              <select
                id="testType"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                required
                value={formData.testType}
                onChange={(e) => setFormData({ ...formData, testType: e.target.value })}
              >
                <option>Pre-Employment Drug Screen</option>
                <option>DOT Drug Test</option>
                <option>Physical Examination</option>
                <option>TB Test</option>
                <option>Respirator Fit Test</option>
              </select>
            </div>

            <div>
              <Label htmlFor="urgency">Urgency</Label>
              <select
                id="urgency"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
              >
                <option value="standard">Standard</option>
                <option value="rush">Rush</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <Label htmlFor="useConcentra">
                Use Concentra Network?
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoIcon className="inline-block ml-1 h-4 w-4 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">If No, provider will generate a custom authorization form for the candidate to choose their own testing location.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <select
                id="useConcentra"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={formData.useConcentra}
                onChange={(e) => setFormData({ ...formData, useConcentra: e.target.value })}
              >
                <option value="yes">Yes - Use Concentra</option>
                <option value="no">No - Allow any location</option>
              </select>
            </div>

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
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <Label htmlFor="jobsiteLocation">Jobsite Location <span className="text-red-500">*</span></Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Where the candidate will be working</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {locations.length > 0 ? (
                <>
                  <Select
                    value={selectedLocationId || (useCustomLocation ? 'custom' : '')}
                    onValueChange={handleLocationSelect}
                  >
                    <SelectTrigger id="jobsiteLocation">
                      <SelectValue placeholder="Select a location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Other (Enter manually)</SelectItem>
                    </SelectContent>
                  </Select>

                  {useCustomLocation && (
                    <Input
                      className="mt-2"
                      required
                      placeholder="e.g., Main Office - 123 Business St, City, State"
                      value={formData.jobsiteLocation}
                      onChange={(e) => setFormData({ ...formData, jobsiteLocation: e.target.value })}
                    />
                  )}
                </>
              ) : (
                <Input
                  id="jobsiteLocation"
                  required
                  placeholder="e.g., Main Office - 123 Business St, City, State"
                  value={formData.jobsiteLocation}
                  onChange={(e) => setFormData({ ...formData, jobsiteLocation: e.target.value })}
                />
              )}
            </div>

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
