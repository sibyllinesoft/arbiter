use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};
use tracing::{info, warn};

/// {{ middleware_name }} middleware
pub async fn {{ function_name }}(
    request: Request,
    next: Next,
) -> Response {
    // Pre-processing logic
    info!("{{ middleware_name }} middleware - processing request");

    // Extract request information if needed
    let method = request.method().clone();
    let uri = request.uri().clone();

    // Process the request
    let response = next.run(request).await;

    // Post-processing logic
    let status = response.status();
    info!("{{ middleware_name }} middleware - request completed: {} {} -> {}",
          method, uri, status);

    response
}
