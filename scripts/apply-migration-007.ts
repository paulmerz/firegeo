import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function applyMigration() {
  const migrationPath = path.join(process.cwd(), 'migrations', '007_add_workspace_to_brand_analyses.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  
  await db.execute(sql.raw(migrationSql));
  console.log('✅ Migration 007 appliquée avec succès');
}

applyMigration().catch(console.error);
