import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const region = process.env['AWS_REGION'] ?? 'us-east-1';
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const TABLE = process.env['VIDEO_JOBS_TABLE'] ?? '';

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

  return res.status(200).json({
    data: {
      jobId,
      status: result.Item['status'],
      progress: result.Item['progress'] ?? 0,
      errorMessage: result.Item['errorMessage'],
    },
  });
}
