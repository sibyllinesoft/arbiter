#!/usr/bin/env bun

/**
 * Debug script to test export engine
 */

import { ExportEngine } from './apps/api/export-engine';

const exportEngine = new ExportEngine();

const cueContent = `
// #OpenAPI user-api version=3.1.0, file=api.yaml
package test

userAPI: {
  openapi: "3.1.0"
  info: { title: "Test API", version: "1.0.0" }
  paths: {}
}`;

console.log('Testing export engine...');

try {
  const result = await exportEngine.export(cueContent, { format: 'openapi' });
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Error:', error);
}