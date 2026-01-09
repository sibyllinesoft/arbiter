//! Integration tests

#[cfg(test)]
mod integration;

// Test utilities
pub mod common {
    use axum_test::TestServer;
    {{db_import}}

    use crate::app::create_app;

    /// Create a test server for integration testing
    pub async fn create_test_server({{db_param}}) -> TestServer {
        let app = create_app({{db_arg}}).await.unwrap();
        TestServer::new(app).unwrap()
    }

    {{db_helper}}
}
