import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const region = process.env['AWS_REGION'] ?? 'us-east-1';
const s3 = new S3Client({ region });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const BUCKET = process.env['VIDEO_PROCESSING_BUCKET'] ?? '';
const TABLE = process.env['VIDEO_JOBS_TABLE'] ?? '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } });
  }

  const { jobId, outputS3Key, inputS3Key } = req.body as {
    jobId?: string;
    outputS3Key?: string;
    inputS3Key?: string;
  };

  if (!jobId || !outputS3Key || !inputS3Key) {
    return res.status(400).json({
      error: { code: 'MISSING_FIELDS', message: 'jobId, outputS3Key, inputS3Key required' },
    });
  }

  await s3.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: [{ Key: inputS3Key }, { Key: outputS3Key }] },
    }),
  );

  await dynamo.send(new DeleteCommand({ TableName: TABLE, Key: { jobId } }));

  // NFR-5: log deletion for audit trail
  console.log(
    JSON.stringify({
      event: 'VIDEO_FILES_DELETED',
      jobId,
      inputS3Key,
      outputS3Key,
      deletedAt: new Date().toISOString(),
    }),
  );

  return res.status(200).json({ data: { deleted: true, deletedAt: new Date().toISOString() } });
}
