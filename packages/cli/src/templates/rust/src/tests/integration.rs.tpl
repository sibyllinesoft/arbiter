use axum::Router;
use tower::ServiceExt; // for `oneshot` and `ready`

use {{module_name}}::app::create_app;

#[tokio::test]
async fn health_check_works() {
    let app = create_app({{db_arg}}).await.expect("app builds");

    let response = app
        .oneshot(
            http::Request::builder()
                .uri("/health")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), http::StatusCode::OK);
}
