
use axum::http::StatusCode;
use axum_test::TestServer;
{{db_import}}

use crate::tests::common::{create_test_server{{db_helper}}};

#[tokio::test]
async fn test_health_endpoint() {
    {{db_setup}}
    let server = create_test_server({{db_arg}}).await;

    let response = server.get("/health").await;
    assert_eq!(response.status_code(), StatusCode::OK);
    let json: serde_json::Value = response.json();
    assert_eq!(json["status"], "healthy");
}

#[tokio::test]
async fn test_ping_endpoint() {
    {{db_setup}}
    let server = create_test_server({{db_arg}}).await;

    let response = server.get("/api/v1/ping").await;
    assert_eq!(response.status_code(), StatusCode::OK);
    assert_eq!(response.text(), "pong");
}

#[tokio::test]
async fn test_not_found() {
    {{db_setup}}
    let server = create_test_server({{db_arg}}).await;

    let response = server.get("/nonexistent").await;
    assert_eq!(response.status_code(), StatusCode::NOT_FOUND);
}
