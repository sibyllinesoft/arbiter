version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - ENVIRONMENT=development
      {{database_env}}
    {{depends_on_block}}
    restart: unless-stopped
{{database_block}}

{{volumes_block}}
