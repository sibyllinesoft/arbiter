use axum::{
    extract::{Path, Query, State},
    response::Json,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tracing::{info, error};

use crate::{
    app::AppState,
    errors::AppError,
    models::{{module_name}}::{ {{struct_name}}, Create{{struct_name}}Request, Update{{struct_name}}Request},
    services::{{module_name}}::{{struct_name}}Service,
};

#[derive(Debug, Deserialize)]
pub struct QueryParams {
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct {{struct_name}}Response {
    pub data: Vec<{{struct_name}}>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
}

/// Get all {{resource_name}} items
pub async fn get_all_{{module_name}}(
    State(app_state): State<AppState>,
    Query(params): Query<QueryParams>,
) -> Result<Json<{{struct_name}}Response>, AppError> {
    info!("Fetching all {{resource_name}} items");
    
    let page = params.page.unwrap_or(1);
    let limit = params.limit.unwrap_or(20);
    
    let service = {{struct_name}}Service::new({{db_pool_ref}});
    
    let (items, total) = service.get_all(page, limit).await?;
    
    let response = {{struct_name}}Response {
        data: items,
        total,
        page,
        limit,
    };
    
    Ok(Json(response))
}

/// Get {{resource_name}} by ID
pub async fn get_{{module_name}}_by_id(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<{{struct_name}}>, AppError> {
    info!("Fetching {{resource_name}} with ID: {}", id);
    
    let service = {{struct_name}}Service::new({{db_pool_ref}});
    let item = service.get_by_id(id).await?;
    
    Ok(Json(item))
}

/// Create new {{resource_name}}
pub async fn create_{{module_name}}(
    State(app_state): State<AppState>,
    Json(payload): Json<Create{{struct_name}}Request>,
) -> Result<(StatusCode, Json<{{struct_name}}>)>, AppError> {
    info!("Creating new {{resource_name}}");
    
    {{validate_line}}
    
    let service = {{struct_name}}Service::new({{db_pool_ref}});
    let item = service.create(payload).await?;
    
    Ok((StatusCode::CREATED, Json(item)))
}

/// Update {{resource_name}}
pub async fn update_{{module_name}}(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<Update{{struct_name}}Request>,
) -> Result<Json<{{struct_name}}>, AppError> {
    info!("Updating {{resource_name}} with ID: {}", id);
    
    {{validate_line}}
    
    let service = {{struct_name}}Service::new({{db_pool_ref}});
    let item = service.update(id, payload).await?;
    
    Ok(Json(item))
}

/// Delete {{resource_name}}
pub async fn delete_{{module_name}}(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    info!("Deleting {{resource_name}} with ID: {}", id);
    
    let service = {{struct_name}}Service::new({{db_pool_ref}});
    service.delete(id).await?;
    
    Ok(StatusCode::NO_CONTENT)
}
