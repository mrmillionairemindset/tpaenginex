import { db } from '@/db';
import { publicTicketForms, tpaSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { PublicFormRenderer } from '@/components/dqf/public-form-renderer';

export default async function PublicApplyPage({ params }: { params: { slug: string } }) {
  // Find form by slug pattern - the publicUrl contains /apply/{slug}
  const forms = await db.query.publicTicketForms.findMany({
    where: eq(publicTicketForms.isActive, true),
  });

  const form = forms.find(f => f.publicUrl?.endsWith(`/${params.slug}`));
  if (!form) notFound();

  // Get TPA branding
  const settings = await db.query.tpaSettings.findFirst({
    where: eq(tpaSettings.tpaOrgId, form.tpaOrgId),
  });

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Header with branding */}
        <div className="text-center mb-8">
          {settings?.logoUrl && (
            <img
              src={settings.logoUrl}
              alt=""
              className="h-12 mx-auto mb-4"
            />
          )}
          <h1 className="text-2xl font-bold">
            {settings?.brandName || 'Driver Application'}
          </h1>
          <p className="text-muted-foreground mt-2">{form.formName}</p>
        </div>
        <PublicFormRenderer formId={form.id} tpaOrgId={form.tpaOrgId} />
      </div>
    </div>
  );
}
