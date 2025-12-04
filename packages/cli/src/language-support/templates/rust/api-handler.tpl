
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
    models::{{moduleName}}::{{structName}},
    models::{{moduleName}}::{Create{{structName}}Request, Update{{structName}}Request},
    services::{{moduleName}}::{{structName}}Service,
};

#[derive(Debug, Deserialize)]
pub struct QueryParams {
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct {{structName}}Response {
    pub data: Vec<{{structName}}>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
}

/// Get all {{name}} items
pub async fn get_all_{{moduleName}}(
    State(app_state): State<AppState>,
    Query(params): Query<QueryParams>,
) -> Result<Json<{{structName}}Response>, AppError> {
    info!("Fetching all {{name}} items");
    let page = params.page.unwrap_or(1);
    let limit = params.limit.unwrap_or(20);
    let service = {{structName}}Service::new({{dbPoolRef}});
    let (items, total) = service.get_all(page, limit).await?;
    Ok(Json({{structName}}Response { data: items, total, page, limit }))
}

/// Get a {{name}} by ID
pub async fn get_{{moduleName}}(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<{{structName}}>, AppError> {
    let service = {{structName}}Service::new({{dbPoolRef}});
    let item = service.get_by_id(id).await?;
    Ok(Json(item))
}

/// Create a {{name}}
pub async fn create_{{moduleName}}(
    State(app_state): State<AppState>,
    Json(payload): Json<Create{{structName}}Request>,
) -> Result<(StatusCode, Json<{{structName}}>), AppError> {
    {{validateLine}}
    let service = {{structName}}Service::new({{dbPoolRef}});
    let item = service.create(payload).await?;
    Ok((StatusCode::CREATED, Json(item)))
}

/// Update a {{name}}
pub async fn update_{{moduleName}}(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<Update{{structName}}Request>,
) -> Result<Json<{{structName}}>, AppError> {
    let service = {{structName}}Service::new({{dbPoolRef}});
    let item = service.update(id, payload).await?;
    Ok(Json(item))
}

/// Delete a {{name}}
pub async fn delete_{{moduleName}}(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let service = {{structName}}Service::new({{dbPoolRef}});
    service.delete(id).await?;
    Ok(StatusCode::NO_CONTENT)
}
