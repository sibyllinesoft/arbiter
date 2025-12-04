//! Application routes

use axum::{
    routing::get,
    Router,
};

use crate::{
    app::AppState,
    handlers::health::health_check,
};

/// Create all application routes
pub fn create_routes() -> Router<AppState> {
    Router::new()
        .route("/health", get(health_check))
        // API v1 routes
        .nest("/api/v1", create_api_v1_routes())
}

/// Create API v1 routes
fn create_api_v1_routes() -> Router<AppState> {
    Router::new()
        .route("/ping", get(ping))
        // Add your API routes here
        // .nest("/users", user_routes())
        // .nest("/items", item_routes())
}

/// Ping endpoint
async fn ping() -> &'static str {
    "pong"
}
