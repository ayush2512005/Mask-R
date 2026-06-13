import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const region = process.env['AWS_REGION'] ?? 'us-east-1';
const s3 = new S3Client({ region });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const BUCKET = process.env['VIDEO_PROCESSING_BUCKET'] ?? '';
const TABLE = process.env['VIDEO_JOBS_TABLE'] ?? '';

// Presigned URL valid for 65 seconds. Client must initiate download within this window,
// then call /api/video/cleanup to delete both S3 objects (satisfies NFR-5).
const DOWNLOAD_URL_TTL_SECONDS = 65;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'GET only' } });
  }

  const { jobId } = req.query;
  if (typeof jobId !== 'string') {
    return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'jobId required' } });
  }

  const result = await dynamo.send(new GetCommand({ TableName: TABLE, Key: { jobId } }));

  if (!result.Item) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
  }

  if (result.Item['status'] !== 'complete') {
    return res.status(400).json({ error: { code: 'NOT_READY', message: 'Job is not complete yet' } });
  }

  const outputS3Key = result.Item['outputS3Key'] as string;
  const inputS3Key = result.Item['inputS3Key'] as string;

  const downloadUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: outputS3Key }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );

  return res.status(200).json({
    data: { downloadUrl, outputS3Key, inputS3Key, jobId },
  });
}
