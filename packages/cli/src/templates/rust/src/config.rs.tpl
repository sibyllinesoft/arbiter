use std::env;

/// Application configuration
#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub environment: String,
    {{database_field}}
    {{auth_field}}
    pub log_level: String,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        let port = env::var("PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse::<u16>()
            .unwrap_or(3000);

        let environment = env::var("ENVIRONMENT")
            .unwrap_or_else(|_| "development".to_string());

{{database_parse}}

{{auth_parse}}

        let log_level = env::var("LOG_LEVEL")
            .unwrap_or_else(|_| "info".to_string());

        Ok(Self {
            port,
            environment,
{{database_return}}
{{auth_return}}
            log_level,
        })
    }

    /// Check if running in production
    pub fn is_production(&self) -> bool {
        self.environment == "production"
    }

    /// Check if running in development
    pub fn is_development(&self) -> bool {
        self.environment == "development"
    }
}
