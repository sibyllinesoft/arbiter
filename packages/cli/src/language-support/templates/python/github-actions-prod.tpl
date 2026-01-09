
name: Python Application CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: '3.11'
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
    - name: Test
      run: pytest

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - uses: actions/checkout@v4
    - name: Build and push Docker image
      env:
        DOCKER_REGISTRY: your-registry.com
      run: |
        docker build -f Dockerfile -t $DOCKER_REGISTRY/your-app:${{ github.sha }} .
        docker push $DOCKER_REGISTRY/your-app:${{ github.sha }}
