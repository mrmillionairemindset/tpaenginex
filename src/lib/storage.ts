import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
// Supports AWS S3, Cloudflare R2, and Supabase Storage
const s3 = new S3Client({
  region: process.env.STORAGE_REGION || 'auto',
  endpoint: process.env.STORAGE_ENDPOINT, // Optional: for R2/Supabase
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY!,
    secretAccessKey: process.env.STORAGE_SECRET_KEY!,
  },
  forcePathStyle: true, // Required for Supabase - use path-style URLs instead of virtual-hosted style
});

const BUCKET = process.env.STORAGE_BUCKET!;

/**
 * Generate a signed URL for uploading a file
 * @param key Storage key/path for the file
 * @param contentType MIME type of the file
 * @returns Signed upload URL (expires in 5 minutes)
 */
export async function getUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes
}

/**
 * Generate a signed URL for downloading a file
 * @param key Storage key/path for the file
 * @returns Signed download URL (expires in 1 hour)
 */
export async function getDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
}

/**
 * Generate a storage key for a document
 * Format: orders/{orderId}/{kind}/{timestamp}-{filename}
 * @param orderId UUID of the order
 * @param kind Document kind (result, chain_of_custody, etc.)
 * @param filename Original filename
 * @returns Storage key path
 */
export function generateStorageKey(orderId: string, kind: string, filename: string): string {
  const timestamp = Date.now();
  // Sanitize filename: remove special characters except dots and hyphens
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `orders/${orderId}/${kind}/${timestamp}-${sanitized}`;
}

/**
 * Upload a file buffer directly to storage
 * @param key Storage key/path for the file
 * @param body File contents as Buffer or Uint8Array
 * @param contentType MIME type of the file
 */
export async function uploadFile(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3.send(command);
}

/**
 * Generate a storage key for a client document
 * Format: client-docs/{clientOrgId}/{timestamp}-{filename}
 * @param clientOrgId UUID of the client organization
 * @param filename Original filename
 * @returns Storage key path
 */
export function generateClientDocStorageKey(clientOrgId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `client-docs/${clientOrgId}/${timestamp}-${sanitized}`;
}

/**
 * Check if storage is configured
 * @returns true if all required env vars are set
 */
export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.STORAGE_ACCESS_KEY &&
    process.env.STORAGE_SECRET_KEY &&
    process.env.STORAGE_BUCKET
  );
}
