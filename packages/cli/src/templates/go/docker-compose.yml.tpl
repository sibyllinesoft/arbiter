version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - ENVIRONMENT=development
{{databaseEnv}}    restart: unless-stopped
{{databaseService}}

{{databaseVolume}}
