import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { poctModelVersions } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { getCurrentUser } from '@/auth/get-user';
import { getDownloadUrl, isStorageConfigured } from '@/lib/storage';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/poct/model-versions — List all model versions
// Mobile app checks for updates. Collector auth required, no specific permission.
// ============================================================================

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const versions = await db.select().from(poctModelVersions)
      .orderBy(desc(poctModelVersions.createdAt));

    // Generate signed download URLs for model binaries
    const storageReady = isStorageConfigured();
    const versionsWithUrls = await Promise.all(
      versions.map(async (v) => {
        let coremlModelUrl: string | null = null;
        let tfliteModelUrl: string | null = null;

        if (storageReady) {
          try {
            if (v.coremlModelKey) {
              coremlModelUrl = await getDownloadUrl(v.coremlModelKey);
            }
            if (v.tfliteModelKey) {
              tfliteModelUrl = await getDownloadUrl(v.tfliteModelKey);
            }
          } catch {
            // Storage issue — URLs stay null
          }
        }

        return {
          ...v,
          coremlModelUrl,
          tfliteModelUrl,
        };
      }),
    );

    return NextResponse.json({ modelVersions: versionsWithUrls });
  } catch (error) {
    console.error('Failed to list POCT model versions:', error);
    return NextResponse.json(
      { error: 'Failed to list POCT model versions' },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST /api/poct/model-versions — Upload new model version (platform_admin only)
// ============================================================================

const postSchema = z.object({
  version: z.string().min(1).max(50),
  description: z.string().max(2000).optional(),
  architecture: z.enum(['mobilenetv3', 'efficientnet_lite']).optional(),
  supportedCassetteTypes: z.array(z.string().min(1)).min(1),
  coremlModelKey: z.string().optional(),
  tfliteModelKey: z.string().optional(),
  accuracy: z.number().min(0).max(1).optional(),
  falsePositiveRate: z.number().min(0).max(1).optional(),
  falseNegativeRate: z.number().min(0).max(1).optional(),
  trainingDatasetSize: z.number().int().positive().optional(),
  releaseNotes: z.string().max(5000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Platform admin access only' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validation = postSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.errors },
        { status: 400 },
      );
    }

    const data = validation.data;

    // Check for duplicate version
    const existing = await db.query.poctModelVersions.findFirst({
      where: (t, { eq }) => eq(t.version, data.version),
      columns: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Model version "${data.version}" already exists` },
        { status: 409 },
      );
    }

    const [modelVersion] = await db.insert(poctModelVersions).values({
      version: data.version,
      description: data.description ?? null,
      architecture: data.architecture ?? null,
      supportedCassetteTypes: data.supportedCassetteTypes,
      coremlModelKey: data.coremlModelKey ?? null,
      tfliteModelKey: data.tfliteModelKey ?? null,
      accuracy: data.accuracy ?? null,
      falsePositiveRate: data.falsePositiveRate ?? null,
      falseNegativeRate: data.falseNegativeRate ?? null,
      trainingDatasetSize: data.trainingDatasetSize ?? null,
      releaseNotes: data.releaseNotes ?? null,
      releasedAt: new Date(),
    }).returning();

    // Audit log — use a generic tpaOrgId for platform actions
    await createAuditLog({
      tpaOrgId: user.orgId ?? 'platform',
      actorUserId: user.id,
      actorEmail: user.email ?? 'unknown',
      entityType: 'poct_model_version',
      entityId: modelVersion.id,
      action: 'poct_model_version_created',
      diffJson: {
        version: data.version,
        architecture: data.architecture,
        supportedCassetteTypes: data.supportedCassetteTypes,
        accuracy: data.accuracy,
      },
    });

    return NextResponse.json({ modelVersion }, { status: 201 });
  } catch (error) {
    console.error('Failed to create POCT model version:', error);
    return NextResponse.json(
      { error: 'Failed to create POCT model version' },
      { status: 500 },
    );
  }
}
