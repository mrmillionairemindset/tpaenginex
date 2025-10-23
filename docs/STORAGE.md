# File Storage Configuration Guide

The RapidScreen platform uses the AWS S3 SDK, which is compatible with multiple cloud storage providers through S3-compatible APIs.

## Supported Storage Providers

### 1. AWS S3 (Native)

```env
STORAGE_BUCKET=rapidscreen-docs
STORAGE_ACCESS_KEY=AKIA...
STORAGE_SECRET_KEY=your-secret-key
STORAGE_REGION=us-east-1
# STORAGE_ENDPOINT is not needed for AWS S3
```

**Setup:**
1. Create an S3 bucket in AWS Console
2. Create an IAM user with S3 permissions
3. Generate access keys for the IAM user
4. Set bucket CORS policy to allow uploads from your domain

---

### 2. Cloudflare R2

```env
STORAGE_BUCKET=rapidscreen-docs
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET_KEY=your-secret-key
STORAGE_REGION=auto
STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

**Setup:**
1. Go to Cloudflare Dashboard > R2
2. Create a new bucket
3. Generate R2 API tokens (Access Key ID and Secret Access Key)
4. Use your account ID in the endpoint URL

**Benefits:**
- No egress fees (free bandwidth)
- Global CDN distribution
- S3-compatible API

---

### 3. Google Cloud Storage (S3-Compatible Mode)

```env
STORAGE_BUCKET=rapidscreen-docs
STORAGE_ACCESS_KEY=GOOG...
STORAGE_SECRET_KEY=your-secret-key
STORAGE_REGION=us-east1  # or your preferred region
STORAGE_ENDPOINT=https://storage.googleapis.com
```

**Setup:**
1. Enable the **Cloud Storage Interoperability API**:
   - Go to Google Cloud Console
   - Navigate to: Cloud Storage > Settings > Interoperability
   - Click "Enable Interoperability API"

2. Create HMAC keys:
   - In the Interoperability tab, click "Create a key for a service account"
   - Or create keys for your user account
   - Save the Access Key (starts with GOOG...) and Secret

3. Create a GCS bucket:
   - Go to Cloud Storage > Buckets
   - Create a new bucket with your preferred name and region
   - Set appropriate permissions (uniform or fine-grained)

4. Configure CORS (if needed):
   ```bash
   gsutil cors set cors.json gs://rapidscreen-docs
   ```

   Where `cors.json` contains:
   ```json
   [
     {
       "origin": ["https://your-domain.com"],
       "method": ["GET", "PUT", "POST", "DELETE"],
       "responseHeader": ["Content-Type"],
       "maxAgeSeconds": 3600
     }
   ]
   ```

**Note:** GCS's S3-compatible API has some limitations:
- Multipart uploads work differently
- Some advanced S3 features may not be available
- Check [GCS S3 compatibility docs](https://cloud.google.com/storage/docs/interoperability) for details

---

### 4. Supabase Storage

```env
STORAGE_BUCKET=rapidscreen-docs
STORAGE_ACCESS_KEY=your-project-ref
STORAGE_SECRET_KEY=your-service-role-key
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3
```

**Setup:**
1. Go to Supabase Dashboard > Storage
2. Create a new bucket (public or private)
3. Get your project reference and service role key from Settings
4. Use the S3-compatible endpoint

---

### 5. DigitalOcean Spaces

```env
STORAGE_BUCKET=rapidscreen-docs
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET_KEY=your-secret-key
STORAGE_REGION=nyc3  # or your preferred region
STORAGE_ENDPOINT=https://nyc3.digitaloceanspaces.com
```

**Setup:**
1. Go to DigitalOcean > Spaces
2. Create a new Space
3. Generate Spaces access keys (API > Tokens/Keys)
4. Use the regional endpoint

---

### 6. MinIO (Self-Hosted)

```env
STORAGE_BUCKET=rapidscreen-docs
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=http://localhost:9000
```

**Setup:**
1. Install MinIO: `docker run -p 9000:9000 minio/minio server /data`
2. Create a bucket via MinIO Console
3. Use default credentials or create new access keys
4. Perfect for local development and testing

---

## Testing Your Configuration

### 1. Check if storage is configured:

The application automatically checks for required environment variables. If storage is not configured, you'll see a 503 error when trying to upload files.

### 2. Test upload flow:

```bash
# Make sure all env vars are set
echo $STORAGE_BUCKET
echo $STORAGE_ACCESS_KEY
echo $STORAGE_SECRET_KEY
echo $STORAGE_REGION
echo $STORAGE_ENDPOINT  # optional for AWS S3

# Restart your dev server
npm run dev
```

### 3. Try uploading a test file:

1. Navigate to `/results/{order-id}` in your app
2. Select a PDF or image file
3. Click "Upload Results"
4. Check the network tab for the upload flow:
   - POST to `/api/files/sign` (should return uploadUrl)
   - PUT to signed URL (should return 200)
   - File should appear in your storage bucket

---

## Security Best Practices

### 1. Bucket Permissions

- **Private buckets**: Recommended for PHI/sensitive data
- **Public read**: Only if you need direct public access
- **Signed URLs**: Always use signed URLs for temporary access

### 2. Access Keys

- Use service accounts or IAM roles when possible
- Rotate keys regularly
- Never commit keys to git
- Use environment variables only

### 3. CORS Configuration

Only allow your production domain:
```json
{
  "origin": ["https://yourdomain.com"],
  "method": ["GET", "PUT"],
  "responseHeader": ["Content-Type"],
  "maxAgeSeconds": 3600
}
```

### 4. Encryption

- Enable encryption at rest in your storage provider
- Use HTTPS for all transfers (enforced by signed URLs)

---

## Troubleshooting

### Error: "File storage is not configured"
- Check all required env vars are set
- Restart your server after changing env vars

### Error: "Failed to upload file to storage"
- Verify access keys are correct
- Check bucket exists
- Verify CORS policy allows your domain
- Check bucket permissions

### Error: "Access Denied"
- Verify IAM/service account has write permissions
- Check bucket policy allows PutObject
- Verify access keys haven't expired

### Files upload but can't download
- Check download permissions in bucket policy
- Verify signed URL expiration hasn't passed
- Check CORS policy allows GET requests

---

## Cost Optimization

### AWS S3
- Use S3 Intelligent-Tiering for automatic cost optimization
- Enable lifecycle policies to move old files to Glacier

### Cloudflare R2
- **Best for high-bandwidth use cases** (no egress fees)
- Competitive storage pricing

### Google Cloud Storage
- Use Nearline or Coldline for archived documents
- Set up lifecycle policies for automatic transitions

### General Tips
- Compress PDFs before upload
- Set file size limits in your application
- Clean up failed/abandoned uploads regularly
- Use object lifecycle policies to delete old temp files

---

## Next Steps

1. Choose your storage provider
2. Set up the bucket and access keys
3. Add environment variables to `.env.local`
4. Test file upload and download
5. Configure CORS if needed
6. Set up monitoring and alerts for storage usage
