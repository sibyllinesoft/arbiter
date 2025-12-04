use axum::{response::Json, http::StatusCode};
use serde_json::{json, Value};
use chrono::Utc;

/// Health check endpoint
pub async fn health_check() -> (StatusCode, Json<Value>) {
    let health_info = json!({
        "status": "healthy",
        "timestamp": Utc::now(),
        "service": "api",
        "version": env!("CARGO_PKG_VERSION")
    });

    (StatusCode::OK, Json(health_info))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum_test::TestServer;
    use crate::app::create_app;

    #[tokio::test]
    async fn test_health_check() {
        let app = create_app(/* db_pool if needed */).await.unwrap();
        let server = TestServer::new(app).unwrap();

        let response = server.get("/health").await;
        assert_eq!(response.status_code(), StatusCode::OK);

        let json: serde_json::Value = response.json();
        assert_eq!(json["status"], "healthy");
    }
}
