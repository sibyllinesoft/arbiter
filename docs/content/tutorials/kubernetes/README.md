# Kubernetes Deployment with Arbiter

This tutorial demonstrates how to use Arbiter to generate production-ready
Kubernetes manifests from CUE specifications. Arbiter's four-layer architecture
(Domain → Contracts → Capabilities → Execution) provides a structured approach
to modeling and deploying cloud-native applications.

## Overview

Arbiter generates Kubernetes environments as part of its comprehensive full-stack
code generation. This tutorial covers:

1. **Modeling Applications**: Define your application using Arbiter's application schema
2. **Infrastructure Generation**: Generate Kubernetes manifests automatically
3. **Deployment Validation**: Validate configurations before deployment
4. **Production Deployment**: Deploy to various Kubernetes environments

## Prerequisites

- Arbiter CLI installed (`npm install -g @sibyllinesoft/arbiter-cli` or standalone binary)
- Kubernetes cluster access (local or cloud)
- Basic understanding of CUE and Kubernetes concepts

## Quick Start

### 1. Initialize an Arbiter Project

```bash
# Initialize a new Arbiter project
arbiter init my-k8s-app
cd my-k8s-app

# Start the Arbiter API server (required for most operations)
arbiter serve &  # Or run in separate terminal
```

### 2. Define Your Application

Create your application specification in `arbiter.assembly.cue`:

```cue
// arbiter.assembly.cue

application: {
    name: "my-microservices"
    version: "1.0.0"

    // Domain layer - business entities
    domain: {
        entities: {
            User: {
                id: string
                email: string
                createdAt: string
            }
            Order: {
                id: string
                userId: string
                amount: number
                status: "pending" | "completed" | "cancelled"
            }
        }
    }

    // Contracts layer - API definitions
    contracts: {
        apis: {
            userService: {
                baseUrl: "/api/users"
                endpoints: {
                    createUser: {
                        method: "POST"
                        path: "/"
                        request: application.domain.entities.User
                        response: application.domain.entities.User
                    }
                    getUser: {
                        method: "GET"
                        path: "/{id}"
                        response: application.domain.entities.User
                    }
                }
            }
            orderService: {
                baseUrl: "/api/orders"
                endpoints: {
                    createOrder: {
                        method: "POST"
                        path: "/"
                        request: application.domain.entities.Order
                        response: application.domain.entities.Order
                    }
                }
            }
        }
    }

    // Capabilities layer - services and features
    capabilities: {
        services: {
            userService: {
                type: "api"
                runtime: "nodejs"
                port: 3001
                implements: application.contracts.apis.userService
                database: {
                    type: "postgresql"
                    name: "users_db"
                }
            }
            orderService: {
                type: "api"
                runtime: "nodejs"
                port: 3002
                implements: application.contracts.apis.orderService
                database: {
                    type: "postgresql"
                    name: "orders_db"
                }
            }
            frontend: {
                type: "web"
                runtime: "react"
                port: 3000
                apis: [
                    application.contracts.apis.userService,
                    application.contracts.apis.orderService
                ]
            }
        }
    }

    // Execution layer - deployment configuration
    execution: {
        environments: {
            production: {
                platform: "kubernetes"
                namespace: "my-microservices-prod"
                replicas: {
                    userService: 3
                    orderService: 3
                    frontend: 2
                }
                resources: {
                    userService: {
                        cpu: "500m"
                        memory: "512Mi"
                        limits: {
                            cpu: "1000m"
                            memory: "1Gi"
                        }
                    }
                    orderService: {
                        cpu: "500m"
                        memory: "512Mi"
                        limits: {
                            cpu: "1000m"
                            memory: "1Gi"
                        }
                    }
                    frontend: {
                        cpu: "100m"
                        memory: "256Mi"
                        limits: {
                            cpu: "500m"
                            memory: "512Mi"
                        }
                    }
                }
                ingress: {
                    enabled: true
                    host: "my-microservices.example.com"
                    tls: true
                }
            }
        }
    }
}
```

### 3. Validate Your Specification

```bash
# Validate the CUE specification
arbiter check

# Check for any issues
arbiter validate arbiter.assembly.cue
```

### 4. Generate Kubernetes Manifests

```bash
# Generate all application artifacts including Kubernetes manifests
arbiter generate my-microservices

# Or generate specific components
arbiter generate my-microservices --target=kubernetes
```

This generates:

- Deployment manifests for each service
- Service definitions for network communication
- ConfigMaps for application configuration
- Ingress configuration for external access
- Persistent Volume Claims for databases
- Namespace definitions
- RBAC configurations

## Generated Kubernetes Structure

When you run `arbiter generate`, the generated Kubernetes manifests are
organized in a structured directory:

```
generated/
├── kubernetes/
│   ├── namespace.yaml                    # Namespace definition
│   ├── services/
│   │   ├── user-service-deployment.yaml
│   │   ├── user-service-service.yaml
│   │   ├── user-service-configmap.yaml
│   │   ├── order-service-deployment.yaml
│   │   ├── order-service-service.yaml
│   │   └── order-service-configmap.yaml
│   ├── frontend/
│   │   ├── frontend-deployment.yaml
│   │   ├── frontend-service.yaml
│   │   └── frontend-configmap.yaml
│   ├── databases/
│   │   ├── users-db-pvc.yaml
│   │   ├── users-db-deployment.yaml
│   │   ├── orders-db-pvc.yaml
│   │   └── orders-db-deployment.yaml
│   ├── ingress/
│   │   └── app-ingress.yaml
│   └── rbac/
│       ├── service-account.yaml
│       ├── role.yaml
│       └── role-binding.yaml
```

All generated manifests include:

- Proper resource limits and requests
- Health checks and readiness probes
- Security contexts and RBAC
- ConfigMaps for environment-specific configuration
- Services for inter-service communication
- Ingress configuration for external access

## Understanding Generated Manifests

### Deployment Example

Here's what a generated deployment looks like for the user service:

```yaml
# user-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: my-microservices-prod
  labels:
    app: user-service
    component: backend
    generated-by: arbiter
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
        component: backend
    spec:
      serviceAccountName: my-microservices-sa
      containers:
        - name: user-service
          image: my-microservices/user-service:latest
          ports:
            - containerPort: 3001
              name: http
          env:
            - name: NODE_ENV
              value: 'production'
            - name: PORT
              value: '3001'
            - name: DATABASE_URL
              valueFrom:
                configMapKeyRef:
                  name: user-service-config
                  key: database-url
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 5
          securityContext:
            allowPrivilegeEscalation: false
            runAsNonRoot: true
            runAsUser: 1000
```

### Service Definition

```yaml
# user-service-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: my-microservices-prod
  labels:
    app: user-service
    generated-by: arbiter
spec:
  selector:
    app: user-service
  ports:
    - name: http
      port: 80
      targetPort: 3001
      protocol: TCP
  type: ClusterIP
```

## Deployment Workflows

### 5. Deploy to Kubernetes

```bash
# Apply generated manifests to your cluster
kubectl apply -f generated/kubernetes/

# Or deploy to a specific environment
kubectl apply -f generated/kubernetes/ -n my-microservices-prod

# Verify environments
kubectl get environments -n my-microservices-prod
kubectl get services -n my-microservices-prod
kubectl get pods -n my-microservices-prod
```

### 6. Monitor Your Application

```bash
# Check deployment status
kubectl rollout status deployment/user-service -n my-microservices-prod
kubectl rollout status deployment/order-service -n my-microservices-prod
kubectl rollout status deployment/frontend -n my-microservices-prod

# View logs
kubectl logs -f deployment/user-service -n my-microservices-prod
kubectl logs -f deployment/order-service -n my-microservices-prod

# Check ingress
kubectl get ingress -n my-microservices-prod
```

## Advanced Configuration

### Environment-Specific Environments

Arbiter supports multiple environment configurations. You can define staging,
production, and development environments:

```cue
execution: {
    environments: {
        development: {
            platform: "kubernetes"
            namespace: "my-microservices-dev"
            replicas: {
                userService: 1
                orderService: 1
                frontend: 1
            }
            resources: {
                userService: {
                    cpu: "100m"
                    memory: "128Mi"
                }
                // ... minimal resources for dev
            }
        }
        staging: {
            platform: "kubernetes"
            namespace: "my-microservices-staging"
            replicas: {
                userService: 2
                orderService: 2
                frontend: 1
            }
            // ... staging-specific configuration
        }
        production: {
            // ... production configuration (as shown above)
        }
    }
}
```

Generate environment-specific manifests:

```bash
# Generate for specific environment
arbiter generate my-microservices --environment=staging
arbiter generate my-microservices --environment=production
```

### Custom Resource Management

Arbiter can also generate custom Kubernetes resources like
HorizontalPodAutoscaler (HPA) and PodDisruptionBudget (PDB):

```cue
execution: {
    environments: {
        production: {
            // ... other configuration
            autoscaling: {
                userService: {
                    enabled: true
                    minReplicas: 3
                    maxReplicas: 10
                    targetCPUUtilization: 70
                    targetMemoryUtilization: 80
                }
                orderService: {
                    enabled: true
                    minReplicas: 3
                    maxReplicas: 15
                    targetCPUUtilization: 70
                }
            }
            podDisruption: {
                userService: {
                    minAvailable: "50%"
                }
                orderService: {
                    minAvailable: 2
                }
            }
        }
    }
}
```

### Secrets and ConfigMaps

Arbiter generates appropriate ConfigMaps and can reference Kubernetes secrets:

```cue
capabilities: {
    services: {
        userService: {
            // ... other configuration
            environment: {
                NODE_ENV: "production"
                LOG_LEVEL: "info"
                API_TIMEOUT: "30000"
            }
            secrets: {
                DATABASE_PASSWORD: {
                    secretName: "user-service-secrets"
                    key: "database-password"
                }
                JWT_SECRET: {
                    secretName: "user-service-secrets"
                    key: "jwt-secret"
                }
            }
        }
    }
}
```

## CI/CD Integration

Arbiter can generate GitHub Actions workflows for automatic deployment:

```bash
# Generate CI/CD workflows
arbiter integrate

# This creates:
# - .github/workflows/deploy.yml
# - .github/workflows/test.yml
# - Docker build and push configurations
```

Example generated workflow excerpt:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Kubernetes
on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install Arbiter CLI
        run: bun install -g @sibyllinesoft/arbiter-cli

      - name: Generate Kubernetes manifests
        run: arbiter generate my-microservices --environment=production

      - name: Deploy to Kubernetes
        run: |
          kubectl apply -f generated/kubernetes/
          kubectl rollout status deployment/user-service -n my-microservices-prod
          kubectl rollout status deployment/order-service -n my-microservices-prod
          kubectl rollout status deployment/frontend -n my-microservices-prod
```

## Troubleshooting Common Issues

### 1. Server Connection Issues

```bash
# Check if Arbiter server is running
arbiter health

# If not running, start it
bun run dev  # From project root
# OR
cd apps/api && bun run dev
```

### 2. Validation Errors

```bash
# Check CUE syntax
arbiter check --verbose

# Validate specific files
arbiter validate arbiter.assembly.cue
```

### 3. Resource Limits

If pods are not starting due to resource constraints:

```cue
execution: {
    environments: {
        production: {
            resources: {
                userService: {
                    cpu: "100m"        # Reduced from 500m
                    memory: "256Mi"    # Reduced from 512Mi
                    limits: {
                        cpu: "500m"    # Reduced from 1000m
                        memory: "512Mi" # Reduced from 1Gi
                    }
                }
            }
        }
    }
}
```

### 4. Ingress Issues

Make sure your cluster has an ingress controller installed:

```bash
# For NGINX ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Wait for it to be ready
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=90s
```

## Best Practices

### 1. Environment Management

- Use separate namespaces for different environments
- Configure different resource limits for dev/staging/production
- Use ConfigMaps for environment-specific configuration
- Store secrets in Kubernetes Secret objects, not in CUE files

### 2. Resource Planning

```cue
execution: {
    environments: {
        production: {
            resources: {
                // CPU requests should be ~50% of limits
                // Memory requests should be ~80% of limits
                userService: {
                    cpu: "500m"
                    memory: "512Mi"
                    limits: {
                        cpu: "1000m"
                        memory: "640Mi"
                    }
                }
            }
        }
    }
}
```

### 3. Security

```cue
execution: {
    environments: {
        production: {
            security: {
                runAsNonRoot: true
                runAsUser: 1000
                allowPrivilegeEscalation: false
                capabilities: {
                    drop: ["ALL"]
                }
            }
        }
    }
}
```

## Advanced Topics

### Custom Health Checks

Arbiter can generate custom health check configurations:

```cue
capabilities: {
    services: {
        userService: {
            healthCheck: {
                livenessProbe: {
                    httpGet: {
                        path: "/health"
                        port: 3001
                    }
                    initialDelaySeconds: 30
                    periodSeconds: 10
                    timeoutSeconds: 5
                    failureThreshold: 3
                }
                readinessProbe: {
                    httpGet: {
                        path: "/ready"
                        port: 3001
                    }
                    initialDelaySeconds: 5
                    periodSeconds: 5
                    timeoutSeconds: 3
                    failureThreshold: 3
                }
            }
        }
    }
}
```

### Database Integration

```cue
capabilities: {
    services: {
        userService: {
            database: {
                type: "postgresql"
                name: "users_db"
                persistence: {
                    enabled: true
                    size: "10Gi"
                    storageClass: "fast-ssd"
                }
            }
        }
    }
}
```

This generates:

- PersistentVolumeClaim for database storage
- PostgreSQL deployment with proper initialization
- ConfigMap with database connection details
- Service for database connectivity

## Conclusion

Arbiter provides a powerful, specification-driven approach to Kubernetes
deployment that:

1. **Reduces Boilerplate**: Generate comprehensive Kubernetes manifests from
   concise CUE specifications
2. **Ensures Consistency**: All environments follow the same patterns and best
   practices
3. **Improves Maintainability**: Single source of truth for your application
   architecture
4. **Enables Automation**: Agent-friendly CLI design perfect for CI/CD pipelines
5. **Supports Growth**: Easy to add new services, environments, and
   configurations

The generated manifests include production-ready features like:

- Proper resource limits and health checks
- Security contexts and RBAC
- ConfigMaps and secret management
- Ingress configuration
- Horizontal Pod Autoscaling
- Pod Disruption Budgets

Start with a simple microservices application and gradually add complexity as
your needs grow. Arbiter's four-layer architecture ensures your application
remains well-structured and maintainable at any scale.

## Next Steps

1. **Explore the Demo Project**: Check out the `examples/demo-project/` directory for a
   complete working example
2. **Read the Core Concepts**: Review `docs/overview/core-concepts.md` (or the
   "Overview → Core Concepts" page in the site) for deeper architecture
   understanding
3. **CLI Reference**: See `docs/reference/cli-reference.md` for complete command
   documentation
4. **Join the Community**: Connect with other Arbiter users for tips and best
   practices

For questions and support, see the project documentation or open an issue on
GitHub.
