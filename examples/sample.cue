// Sample CUE specification for Spec Workbench
package example

// Define application capabilities
capabilities: {
	authentication: {
		name:        "User Authentication"
		description: "Secure user login and session management"
		status:      "implemented"
		priority:    "high"
		complexity:  "medium"
		owner:       "auth-team"
		
		requirements: {
			secure_storage: "passwords must be hashed with bcrypt"
			session_expiry: "sessions expire after 24 hours"
			multi_factor:   "support for TOTP-based 2FA"
		}
		
		endpoints: {
			"/auth/login":    "POST - authenticate user credentials"
			"/auth/logout":   "POST - invalidate user session"
			"/auth/refresh":  "POST - refresh access token"
			"/auth/register": "POST - create new user account"
		}
	}
	
	user_management: {
		name:        "User Management"
		description: "User profile and account management"
		status:      "draft"
		priority:    "medium"
		complexity:  "low"
		owner:       "backend-team"
		depends_on: ["authentication"]
		
		requirements: {
			profile_editing: "users can update their profiles"
			account_deletion: "users can delete their accounts"
			privacy_controls: "granular privacy settings"
		}
		
		endpoints: {
			"/users/profile":     "GET, PUT - user profile management"
			"/users/settings":    "GET, PUT - user settings"
			"/users/delete":      "DELETE - account deletion"
		}
	}
	
	notifications: {
		name:        "Notification System"
		description: "Real-time and batch notification delivery"
		status:      "planned"
		priority:    "low"
		complexity:  "high"
		owner:       "platform-team"
		depends_on: ["authentication", "user_management"]
		
		requirements: {
			real_time: "WebSocket-based real-time notifications"
			email_delivery: "reliable email notification delivery"
			push_notifications: "mobile push notification support"
			preferences: "per-user notification preferences"
		}
		
		channels: {
			websocket: "real-time browser notifications"
			email:     "batch and transactional emails"
			push:      "mobile push notifications"
			sms:       "SMS for critical alerts"
		}
	}
}

// Define user flows
flows: {
	user_registration: {
		name:        "User Registration Flow"
		description: "Complete user onboarding process"
		trigger:     "user clicks 'Sign Up'"
		outcome:     "verified user account created"
		
		steps: [
			{
				name:   "Email Collection"
				actor:  "user"
				action: "enters email address"
			},
			{
				name:   "Email Verification"
				actor:  "system"
				action: "sends verification email"
			},
			{
				name:   "Account Creation"
				actor:  "user"
				action: "completes profile information"
			},
			{
				name:   "Welcome Sequence"
				actor:  "system"
				action: "sends welcome email and notifications"
			}
		]
	}
	
	password_reset: {
		name:        "Password Reset Flow"
		description: "Secure password recovery process"
		trigger:     "user clicks 'Forgot Password'"
		outcome:     "password successfully reset"
		
		steps: [
			{
				name:   "Email Lookup"
				actor:  "user"
				action: "enters registered email address"
			},
			{
				name:   "Reset Link Generation"
				actor:  "system"
				action: "generates secure reset token"
			},
			{
				name:   "Password Reset"
				actor:  "user"
				action: "sets new password via reset link"
			}
		]
	}
}

// Define services that implement capabilities
services: {
	auth_service: {
		name:        "Authentication Service"
		technology:  "Node.js + Express"
		environment: "production"
		implements: ["authentication"]
		
		database: {
			type:   "PostgreSQL"
			schema: "users, sessions, tokens"
		}
		
		dependencies: {
			redis:     "session storage"
			sendgrid:  "email delivery"
			vault:     "secrets management"
		}
	}
	
	user_service: {
		name:        "User Management Service"
		technology:  "Python + FastAPI"
		environment: "production"
		implements: ["user_management"]
		
		database: {
			type:   "PostgreSQL"
			schema: "user_profiles, preferences, privacy_settings"
		}
	}
	
	notification_service: {
		name:        "Notification Service"
		technology:  "Go + Gin"
		environment: "development"
		implements: ["notifications"]
		
		message_queue: {
			type:   "RabbitMQ"
			queues: ["email", "push", "websocket"]
		}
	}
}

// Define test cases
tests: {
	auth_login_success: {
		name:        "Successful Login Test"
		type:        "integration"
		capability:  "authentication"
		automated:   true
		status:      "passing"
		
		scenario: {
			given: "valid user credentials"
			when:  "POST to /auth/login"
			then:  "returns access token and user info"
		}
	}
	
	auth_invalid_password: {
		name:        "Invalid Password Test"
		type:        "integration"
		capability:  "authentication"
		automated:   true
		status:      "passing"
		
		scenario: {
			given: "valid email but wrong password"
			when:  "POST to /auth/login"
			then:  "returns 401 Unauthorized"
		}
	}
	
	user_profile_update: {
		name:        "Profile Update Test"
		type:        "integration"
		capability:  "user_management"
		automated:   false
		status:      "pending"
		
		scenario: {
			given: "authenticated user"
			when:  "PUT to /users/profile with new data"
			then:  "profile is updated successfully"
		}
	}
}

// Define requirements
requirements: {
	security_req_001: {
		name:       "Password Security"
		priority:   "critical"
		status:     "implemented"
		capability: "authentication"
		source:     "security_audit_2024"
		
		description: "All user passwords must be hashed using bcrypt with minimum cost factor 12"
	}
	
	performance_req_001: {
		name:       "API Response Time"
		priority:   "high"
		status:     "implemented"
		capability: "authentication"
		source:     "performance_requirements"
		
		description: "Authentication endpoints must respond within 200ms for 95% of requests"
	}
	
	compliance_req_001: {
		name:       "GDPR Compliance"
		priority:   "critical"
		status:     "draft"
		capability: "user_management"
		source:     "legal_requirements"
		
		description: "Users must be able to export and delete all personal data"
	}
}