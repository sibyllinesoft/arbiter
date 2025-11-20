use axum::{
    routing::{get, post, put, delete},
    Router,
};

use crate::{
    app::AppState,
    handlers::{{module_name}}::{
        get_all_{{module_name}},
        get_{{module_name}}_by_id,
        create_{{module_name}},
        update_{{module_name}},
        delete_{{module_name}},
    },
};

/// Create {{resource_name}} routes
pub fn create_{{module_name}}_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(get_all_{{module_name}}).post(create_{{module_name}}))
        .route("/:id", get(get_{{module_name}}_by_id).put(update_{{module_name}}).delete(delete_{{module_name}}))
}
