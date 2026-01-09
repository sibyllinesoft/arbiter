//! {{ app_name }} - {{ description }}

pub mod app;
pub mod config;
{{ database_module }}pub mod errors;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod routes;
pub mod services;

pub use config::Config;
{{ database_reexport }}pub use errors::AppError;

// Re-export commonly used types
pub use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    Router,
};
pub use serde::{Deserialize, Serialize};
pub use uuid::Uuid;
