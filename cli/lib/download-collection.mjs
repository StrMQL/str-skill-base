import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import extract from 'extract-zip';
import { createClient } from './api.js';

export async function downloadCollectionZip(collectionId) {
  const client = createClient();
  const response = await client.download(`/collections/${encodeURIComponent(collectionId)}/download`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function extractCollectionZip(buffer, targetDir) {
  const tmpZip = path.join(os.tmpdir(), `skb-collection-${Date.now()}.zip`);
  fs.writeFileSync(tmpZip, buffer);
  fs.mkdirSync(targetDir, { recursive: true });

  try {
    await extract(tmpZip, { dir: path.resolve(targetDir) });
  } finally {
    try {
      fs.unlinkSync(tmpZip);
    } catch {
      // ignore
    }
  }
}

export async function fetchCollectionDetail(collectionId) {
  const client = createClient();
  return client.get(`/collections/${encodeURIComponent(collectionId)}`);
}
