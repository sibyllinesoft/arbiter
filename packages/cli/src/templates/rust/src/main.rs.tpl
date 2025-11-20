use std::net::SocketAddr;

use axum::Server;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use {{module_name}}::{
    app::create_app,
    config::Config,
    {{database_import}}
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "{{tracing_env}}".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting {{service_name}} application");

    // Load configuration
    let config = Config::from_env()?;
    
    {{database_block}}

    // Create application
    let app = create_app({{database_arg}}).await?;

    // Setup server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!("Server listening on {}", addr);

    // Start server
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app)
        .await
        .map_err(|e| {
            error!("Server error: {}", e);
            e
        })?;

    Ok(())
}
