version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DEBUG=true
      {{database_env}}
    {{depends_on_block}}
    volumes:
      - .:/app
    restart: unless-stopped
{{database_block}}

{{volumes_block}}
