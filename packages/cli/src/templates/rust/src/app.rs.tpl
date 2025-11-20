use axum::{
    http::{
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE},
        HeaderValue, Method,
    },
    Router,
};
use tower::ServiceBuilder;
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
};
{{db_use}}

use crate::{
    routes::create_routes,
    errors::AppError,
};

/// Application state
#[derive(Clone)]
pub struct AppState {
{{db_field}}
}

impl AppState {
    /// Create new application state
    pub fn new({{db_ctor_param}}) -> Self {
        Self {
{{db_ctor_assign}}
        }
    }
}

/// Create the main application with all routes and middleware
pub async fn create_app({{db_ctor_param}}) -> Result<Router, AppError> {
    // Create application state
    let app_state = AppState::new({{db_ctor_arg}});

    // Create CORS layer
    let cors = CorsLayer::new()
        .allow_origin("http://localhost:3000".parse::<HeaderValue>().unwrap())
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
        .allow_credentials(true)
        .allow_headers([AUTHORIZATION, ACCEPT, CONTENT_TYPE]);

    // Build the application
    let app = Router::new()
        .merge(create_routes())
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(cors),
        )
        .with_state(app_state);

    Ok(app)
}
