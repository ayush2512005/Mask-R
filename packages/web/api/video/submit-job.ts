import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const region = process.env['AWS_REGION'] ?? 'us-east-1';
const ecs = new ECSClient({ region });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const TABLE = process.env['VIDEO_JOBS_TABLE'] ?? '';
const CLUSTER = process.env['ECS_CLUSTER_ARN'] ?? '';
const TASK_DEF = process.env['ECS_TASK_DEFINITION_ARN'] ?? '';
const SUBNETS = (process.env['ECS_SUBNET_IDS'] ?? '').split(',').filter(Boolean);
const SECURITY_GROUP = process.env['ECS_SECURITY_GROUP_ID'] ?? '';
const BUCKET = process.env['VIDEO_PROCESSING_BUCKET'] ?? '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } });
  }

  const { jobId, s3Key, redactionConfig } = req.body as {
    jobId?: string;
    s3Key?: string;
    redactionConfig?: unknown;
  };

  if (!jobId || !s3Key || !redactionConfig) {
    return res.status(400).json({
      error: { code: 'MISSING_FIELDS', message: 'jobId, s3Key, redactionConfig required' },
    });
  }

  const outputKey = `output/${jobId}/redacted.mp4`;

  const task = await ecs.send(
    new RunTaskCommand({
      cluster: CLUSTER,
      taskDefinition: TASK_DEF,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: SUBNETS,
          securityGroups: [SECURITY_GROUP],
          assignPublicIp: 'ENABLED',
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: 'video-processor',
            environment: [
              { name: 'JOB_ID', value: jobId },
              { name: 'INPUT_BUCKET', value: BUCKET },
              { name: 'INPUT_KEY', value: s3Key },
              { name: 'OUTPUT_BUCKET', value: BUCKET },
              { name: 'OUTPUT_KEY', value: outputKey },
              { name: 'REDACTION_CONFIG', value: JSON.stringify(redactionConfig) },
              { name: 'JOBS_TABLE', value: TABLE },
              { name: 'AWS_REGION', value: region },
            ],
          },
        ],
      },
    }),
  );

  const taskArn = task.tasks?.[0]?.taskArn ?? 'unknown';

  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { jobId },
      UpdateExpression: 'SET #s = :s, outputS3Key = :ok, ecsTaskArn = :ta',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': 'processing', ':ok': outputKey, ':ta': taskArn },
    }),
  );

  return res.status(200).json({ data: { jobId } });
}
