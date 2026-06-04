/**
 * One-time script: sets CORS policy on the GCS bucket so browsers can PUT upload files.
 * Run once: npx ts-node -r tsconfig-paths/register scripts/set-gcs-cors.ts
 */
import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

dotenv.config();

const {
  GCP_PROJECT_ID,
  GCP_BUCKET_NAME,
  GCP_PRIVATE_KEY,
  GCP_PRIVATE_KEY_ID,
  GCP_CLIENT_EMAIL,
  GCP_CLIENT_ID,
} = process.env;

if (!GCP_BUCKET_NAME) {
  console.error('GCP_BUCKET_NAME not set');
  process.exit(1);
}

const storage = GCP_CLIENT_EMAIL && GCP_PRIVATE_KEY
  ? new Storage({
      projectId: GCP_PROJECT_ID,
      credentials: {
        type: 'service_account',
        project_id: GCP_PROJECT_ID,
        private_key_id: GCP_PRIVATE_KEY_ID,
        private_key: GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: GCP_CLIENT_EMAIL,
        client_id: GCP_CLIENT_ID,
      },
    })
  : new Storage({ projectId: GCP_PROJECT_ID });

async function main() {
  await storage.bucket(GCP_BUCKET_NAME!).setCorsConfiguration([
    {
      origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://takshashila.tconsolutions.com',
        'https://www.takshashila.tconsolutions.com',
      ],
      method: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
      responseHeader: [
        'Content-Type',
        'Access-Control-Allow-Origin',
        'x-goog-resumable',
        'Authorization',
      ],
      maxAgeSeconds: 3600,
    },
  ]);

  console.log(`CORS set on bucket: ${GCP_BUCKET_NAME}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
