version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - ENVIRONMENT=development
      {{#hasDatabase}}- DATABASE_URL=postgres://{{moduleName}}:password@database:5432/{{moduleName}}?sslmode=disable{{/hasDatabase}}
    {{#hasDatabase}}depends_on:
      database:
        condition: service_healthy{{/hasDatabase}}
    restart: unless-stopped
{{#hasDatabase}}
  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: {{moduleName}}
      POSTGRES_PASSWORD: password
      POSTGRES_DB: {{moduleName}}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U {{moduleName}}"]
      interval: 10s
      timeout: 5s
      retries: 5
{{/hasDatabase}}

{{#hasDatabase}}volumes:
  postgres_data:
{{/hasDatabase}}
