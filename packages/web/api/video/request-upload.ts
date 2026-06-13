import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const region = process.env['AWS_REGION'] ?? 'us-east-1';
const s3 = new S3Client({ region });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const BUCKET = process.env['VIDEO_PROCESSING_BUCKET'] ?? '';
const TABLE = process.env['VIDEO_JOBS_TABLE'] ?? '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } });
  }

  const { filename, contentType, sizeBytes } = req.body as {
    filename?: string;
    contentType?: string;
    sizeBytes?: number;
  };

  if (!filename || !contentType || typeof sizeBytes !== 'number') {
    return res.status(400).json({
      error: { code: 'MISSING_FIELDS', message: 'filename, contentType, sizeBytes required' },
    });
  }

  const MAX_BYTES = 2 * 1024 * 1024 * 1024;
  if (sizeBytes > MAX_BYTES) {
    return res.status(400).json({
      error: { code: 'FILE_TOO_LARGE', message: 'Maximum video size is 2 GB' },
    });
  }

  const jobId = uuidv4();
  const s3Key = `input/${jobId}/${filename}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    }),
    { expiresIn: 3600 },
  );

  // TTL: 1 hour — DynamoDB auto-deletes stale jobs that never completed
  const ttl = Math.floor(Date.now() / 1000) + 3600;

  await dynamo.send(
    new PutCommand({
      TableName: TABLE,
      Item: { jobId, status: 'pending', progress: 0, inputS3Key: s3Key, createdAt: new Date().toISOString(), ttl },
    }),
  );

  return res.status(200).json({ data: { uploadUrl, s3Key, jobId } });
}
