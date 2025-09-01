// Kubernetes Configuration Example
package kubernetes

// Deployment configuration
deployment: {
	apiVersion: "apps/v1"
	kind:       "Deployment"
	metadata: {
		name:      "my-app"
		namespace: "production"
	}
	spec: {
		replicas: 3
		selector: matchLabels: app: "my-app"
		template: {
			metadata: labels: app: "my-app"
			spec: {
				containers: [{
					name:  "app"
					image: "my-app:latest"
					ports: [{
						containerPort: 8080
						protocol:      "TCP"
					}]
					env: [{
						name:  "NODE_ENV"
						value: "production"
					}]
					resources: {
						requests: {
							cpu:    "100m"
							memory: "128Mi"
						}
						limits: {
							cpu:    "500m"
							memory: "512Mi"
						}
					}
				}]
			}
		}
	}
}

// Service configuration
service: {
	apiVersion: "v1"
	kind:       "Service"
	metadata: {
		name:      "my-app-service"
		namespace: "production"
	}
	spec: {
		selector: app: "my-app"
		ports: [{
			port:       80
			targetPort: 8080
			protocol:   "TCP"
		}]
		type: "ClusterIP"
	}
}