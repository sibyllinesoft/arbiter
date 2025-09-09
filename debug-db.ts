#!/usr/bin/env bun
/**
 * Debug script to check database contents
 */
import { Database } from "bun:sqlite";

const dbPath = "./apps/api/spec_workbench.db";
console.log(`Checking database: ${dbPath}`);

try {
  const db = new Database(dbPath, { readonly: true });
  
  // Get all table names
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables:", tables);
  
  // Check projects table
  try {
    const projects = db.prepare("SELECT * FROM projects LIMIT 5").all();
    console.log("Projects:", projects);
    
    const projectCount = db.prepare("SELECT COUNT(*) as count FROM projects").get();
    console.log("Total projects:", projectCount);
  } catch (e) {
    console.log("Error querying projects:", e);
  }
  
  // Check fragments table
  try {
    const fragments = db.prepare("SELECT project_id, path, LENGTH(content) as content_length FROM fragments LIMIT 5").all();
    console.log("Fragments:", fragments);
    
    const fragmentCount = db.prepare("SELECT COUNT(*) as count FROM fragments").get();
    console.log("Total fragments:", fragmentCount);
  } catch (e) {
    console.log("Error querying fragments:", e);
  }
  
  db.close();
} catch (error) {
  console.error("Database error:", error);
}