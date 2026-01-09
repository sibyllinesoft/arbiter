use uuid::Uuid;
use tracing::{info, error};
{{db_import}}

use crate::{
    errors::AppError,
    models::{{module_name}}::{ {{struct_name}}, Create{{struct_name}}Request, Update{{struct_name}}Request },
};

/// Service for {{resource_name}} business logic
pub struct {{struct_name}}Service{{lifet}} {
    {{service_struct}}
}

impl{{lifet}} {{struct_name}}Service{{lifet}} {
    /// Create a new service instance
    pub fn new({{ctor_params}}) -> Self {
        Self {
            {{ctor_fields}}
        }
    }

    /// Get all {{resource_name}} items with pagination
    pub async fn get_all(&self, page: u32, limit: u32) -> Result<(Vec<{{struct_name}}>, u64), AppError> {
        info!("Fetching all {{resource_name}} items (page: {}, limit: {})", page, limit);
        
{{get_all_body}}
    }

    /// Get {{resource_name}} by ID
    pub async fn get_by_id(&self, id: Uuid) -> Result<{{struct_name}}, AppError> {
        info!("Fetching {{resource_name}} with ID: {}", id);
        
{{get_by_id_body}}
    }

    /// Create new {{resource_name}}
    pub async fn create(&self, request: Create{{struct_name}}Request) -> Result<{{struct_name}}, AppError> {
        info!("Creating new {{resource_name}}");
        
{{create_body}}
    }

    /// Update {{resource_name}}
    pub async fn update(&self, id: Uuid, request: Update{{struct_name}}Request) -> Result<{{struct_name}}, AppError> {
        info!("Updating {{resource_name}} with ID: {}", id);
        
{{update_body}}
    }

    /// Delete {{resource_name}} (soft delete)
    pub async fn delete(&self, id: Uuid) -> Result<(), AppError> {
        info!("Deleting {{resource_name}} with ID: {}", id);
        
{{delete_body}}
    }
}
