#!/usr/bin/env bun
/**
 * Fix missing projects by creating project records for existing fragments
 */
import { Database } from 'bun:sqlite';

const dbPath = './apps/api/spec_workbench.db';
console.log(`Fixing projects in database: ${dbPath}`);

try {
  const db = new Database(dbPath);

  // Get all unique project_ids from fragments
  const fragmentProjectIds = db.prepare('SELECT DISTINCT project_id FROM fragments').all();
  console.log('Found fragment project IDs:', fragmentProjectIds);

  // Check which projects already exist
  const existingProjects = db.prepare('SELECT id FROM projects').all();
  console.log('Existing projects:', existingProjects);

  // Create missing projects
  const insertProject = db.prepare(`
    INSERT INTO projects (id, name, created_at, updated_at) 
    VALUES (?, ?, datetime('now'), datetime('now'))
  `);

  for (const fragment of fragmentProjectIds) {
    const projectId = fragment.project_id;

    // Check if project exists
    const exists = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId);

    if (!exists) {
      console.log(`Creating project: ${projectId}`);

      // Create a friendly project name
      const projectName = projectId
        .replace(/-demo$/, '')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      insertProject.run(projectId, projectName);
      console.log(`✅ Created project: ${projectId} -> ${projectName}`);
    }
  }

  // Verify results
  const finalProjects = db.prepare('SELECT * FROM projects').all();
  console.log('\nFinal projects:', finalProjects);

  const finalFragments = db.prepare('SELECT project_id, path FROM fragments').all();
  console.log('\nFinal fragments:', finalFragments);

  db.close();
  console.log('\n🎉 Database fixed!');
} catch (error) {
  console.error('Database error:', error);
}
