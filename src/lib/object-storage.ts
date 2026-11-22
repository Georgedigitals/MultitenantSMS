import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface StoredObjectImage {
  url: string;
  key: string;
}

function hmac(key: Buffer | string, value: string) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest();
}

function encodeObjectKey(key: string) {
  return key.split('/').map(encodeURIComponent).join('/');
}

async function putS3CompatibleObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const endpointValue = process.env.OBJECT_STORAGE_ENDPOINT;
  const bucket = process.env.OBJECT_STORAGE_BUCKET;
  const region = process.env.OBJECT_STORAGE_REGION || 'us-east-1';
  const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY;
  const publicBaseUrl = process.env.OBJECT_STORAGE_PUBLIC_URL;

  if (!endpointValue || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    throw new Error('Production uploads require complete S3-compatible object storage configuration.');
  }

  const endpoint = new URL(endpointValue);
  if (endpoint.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new Error('Production object storage endpoint must use HTTPS.');
  }
  const publicUrl = new URL(publicBaseUrl);
  if (publicUrl.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new Error('Production object storage public URL must use HTTPS.');
  }

  const objectPath = `${endpoint.pathname.replace(/\/$/, '')}/${encodeURIComponent(bucket)}/${encodeObjectKey(key)}`;
  const objectUrl = new URL(objectPath, endpoint.origin);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${objectUrl.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    '',
  ].join('\n');
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    objectUrl.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(objectUrl, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    console.error('[Object Storage] Upload rejected by provider', { status: response.status });
    throw new Error('Image could not be stored by the configured object-storage provider.');
  }

  return `${publicUrl.toString().replace(/\/$/, '')}/${encodeObjectKey(key)}`;
}

/** Stores a validated image in durable object storage if configured, or persistent local storage. */
export async function storePublicImage(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<StoredObjectImage> {
  const hasS3Config = Boolean(
    process.env.OBJECT_STORAGE_ENDPOINT &&
    process.env.OBJECT_STORAGE_BUCKET &&
    process.env.OBJECT_STORAGE_ACCESS_KEY_ID &&
    process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY &&
    process.env.OBJECT_STORAGE_PUBLIC_URL
  );

  if (hasS3Config) {
    try {
      return { key, url: await putS3CompatibleObject(key, body, contentType) };
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        throw err;
      }
      console.warn(
        '[Object Storage] S3 upload unreachable in development; falling back to local public/uploads:',
        err instanceof Error ? err.message : err
      );
    }
  }

  // Fallback to local storage (persisted via Docker uploads_data volume)
  const safeKey = encodeObjectKey(key);
  const target = path.resolve(process.cwd(), 'public', 'uploads', ...key.split('/'));
  const root = path.resolve(process.cwd(), 'public', 'uploads');
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error('Invalid upload object key.');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, body);
  return { key, url: `/uploads/${safeKey}` };
}
