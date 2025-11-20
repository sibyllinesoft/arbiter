use sqlx::{PgPool, postgres::PgPoolOptions};
use tracing::{info, error};

use crate::errors::AppError;

/// Create database connection pool
pub async fn create_pool(database_url: &str) -> Result<PgPool, AppError> {
    info!("Creating database connection pool");

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
        .map_err(|e| {
            error!("Failed to create database pool: {}", e);
            AppError::DatabaseError(e.to_string())
        })?;

    // Test the connection
    sqlx::query("SELECT 1")
        .execute(&pool)
        .await
        .map_err(|e| {
            error!("Failed to test database connection: {}", e);
            AppError::DatabaseError(e.to_string())
        })?;

    info!("Database connection pool created successfully");
    Ok(pool)
}
