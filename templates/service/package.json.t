{
  "name": "{{.name}}",
  "version": "{{.version}}",
  "description": "{{.description}}",
  "author": "{{.author}}",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "test": "jest",
    "type-check": "tsc --noEmit",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.14",
    "@types/node": "^20.5.0",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1",
    "jest": "^29.6.2",
    "@types/jest": "^29.5.4",
    "ts-jest": "^29.1.1",
    "eslint": "^8.47.0",
    "@typescript-eslint/parser": "^6.4.0",
    "@typescript-eslint/eslint-plugin": "^6.4.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}