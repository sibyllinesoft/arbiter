/**
 * Dependency Matrix for Artifact Type Detection
 *
 * Maps dependencies to artifact categories with confidence weights.
 * Categories represent primary artifact types like CLI, web service, frontend, etc.
 */

const DEPENDENCY_MATRIX = {
  cli: {
    weight: 0.9,
    dependencies: [
      'commander',
      'yargs',
      'inquirer',
      'ora',
      'chalk',
      'cli-table3',
      'boxen',
      'caporal',
      'cac',
      'clipanion',
      'meow',
      'minimist',
      'arg',
      '@oclif/core',
    ],
  },
  web_service: {
    weight: 0.85,
    dependencies: [
      'express',
      'fastify',
      'koa',
      'hapi',
      'nestjs',
      'restify',
      'sails',
      'feathers',
      'apollo-server',
      'graphql-yoga',
      'trpc',
      'socket.io',
      'ws',
      'hono',
    ],
  },
  frontend: {
    weight: 0.8,
    dependencies: [
      'react',
      'vue',
      'angular',
      'svelte',
      'solid-js',
      'preact',
      'lit',
      'next',
      'nuxt',
      'gatsby',
      'remix',
      'storybook',
      '@storybook/react',
      'cypress',
      'playwright',
    ],
  },
  library: {
    weight: 0.7,
    dependencies: [
      'lodash',
      'ramda',
      'underscore',
      'moment',
      'date-fns',
      'axios',
      'got',
      'node-fetch',
      'cheerio',
      'papaparse',
      'uuid',
      'joi',
      'zod',
      'yup',
      'class-validator',
    ],
  },
  database: {
    weight: 0.75,
    dependencies: [
      'mongoose',
      'sequelize',
      'typeorm',
      'prisma',
      'drizzle-orm',
      'pg',
      'mysql2',
      'mongodb',
      'redis',
      'ioredis',
      'knex',
      'objection',
      'mikro-orm',
      'sqlite3',
      'better-sqlite3',
    ],
  },
  testing: {
    weight: 0.6,
    dependencies: [
      'jest',
      'mocha',
      'vitest',
      'chai',
      'sinon',
      'supertest',
      'nyc',
      'c8',
      '@testing-library/react',
      '@testing-library/jest-dom',
    ],
  },
  build_tool: {
    weight: 0.65,
    dependencies: [
      'webpack',
      'vite',
      'rollup',
      'esbuild',
      'parcel',
      'turbopack',
      'tsup',
      'babel',
      '@babel/core',
      'terser',
      'swc',
    ],
  },
  desktop_app: {
    weight: 0.8,
    dependencies: ['electron', 'tauri', 'neutralinojs', '@electron-forge/cli'],
  },
  mobile: {
    weight: 0.8,
    dependencies: ['react-native', 'expo', 'ionic', '@capacitor/core', 'cordova'],
  },
  game: {
    weight: 0.75,
    dependencies: ['phaser', 'three', 'babylonjs', 'pixi.js', 'cannon-es', 'matter-js'],
  },
  data_processing: {
    weight: 0.7,
    dependencies: ['papaparse', 'xlsx', 'cheerio', 'puppeteer', 'playwright', 'pdfkit', 'jsdom'],
  },
};

function determineMostLikelyCategory(dependencies, language = 'javascript') {
  let bestCategory = 'library';
  let bestScore = 0;

  Object.entries(DEPENDENCY_MATRIX).forEach(([category, matrix]) => {
    const matches = dependencies.filter(dep =>
      matrix.dependencies.some(matrixDep => dep.toLowerCase().includes(matrixDep.toLowerCase()))
    );
    const score = matches.length * matrix.weight;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  });

  return bestCategory;
}

function getAllCategoriesByConfidence(dependencies, language = 'javascript') {
  const scores = Object.entries(DEPENDENCY_MATRIX).map(([category, matrix]) => {
    const matches = dependencies.filter(dep =>
      matrix.dependencies.some(matrixDep => dep.toLowerCase().includes(matrixDep.toLowerCase()))
    );
    const confidence = Math.min(1.0, (matches.length / matrix.dependencies.length) * matrix.weight);
    return { category, confidence };
  });

  return scores.sort((a, b) => b.confidence - a.confidence);
}

function getCategoryExplanation(dependencies, language, category) {
  const matrix = DEPENDENCY_MATRIX[category];
  if (!matrix) return [];

  const matches = dependencies.filter(dep =>
    matrix.dependencies.some(matrixDep => dep.toLowerCase().includes(matrixDep.toLowerCase()))
  );

  return matches.slice(0, 5); // Top 5 matches
}

export {
  determineMostLikelyCategory,
  getAllCategoriesByConfidence,
  getCategoryExplanation,
  DEPENDENCY_MATRIX,
};
