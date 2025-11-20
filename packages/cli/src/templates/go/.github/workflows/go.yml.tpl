name: Go Application CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: "1.21"

      - name: Install dependencies
        run: go mod download

      - name: Run tests
        run: go test ./...

      - name: Build binary
        run: |
          CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo \
            -ldflags='-w -s -extldflags "-static"' \
            -o bin/app cmd/main.go

      - name: Build Docker image
        run: |
          docker build -f Dockerfile.prod -t {{dockerImage}}:${{ github.sha }} .
          docker tag {{dockerImage}}:${{ github.sha }} {{dockerImage}}:latest

      - name: Push Docker image
        if: github.ref == 'refs/heads/main'
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
          docker push {{dockerImage}}:${{ github.sha }}
          docker push {{dockerImage}}:latest
