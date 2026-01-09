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

    info!("Starting application");

    // Load configuration
    let config = Config::from_env()?;

    {{database_block}}

    // Create Axum application
    let app = create_app({{database_arg}}).await?;

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!("Listening on http://{}", addr);
    Server::bind(&addr)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
