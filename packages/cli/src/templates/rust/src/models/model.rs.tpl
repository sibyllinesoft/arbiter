use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
{{extra_imports}}

#[derive(Debug, Clone, Serialize, Deserialize{{from_row_derive}})]
pub struct {{struct_name}} {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request payload for creating a {{struct_name}}
#[derive(Debug, Deserialize{{validate_derive}})]
pub struct Create{{struct_name}}Request {
    {{name_validate}}
    pub name: String,
    {{desc_validate}}
    pub description: Option<String>,
}

/// Request payload for updating a {{struct_name}}
#[derive(Debug, Deserialize{{validate_derive}})]
pub struct Update{{struct_name}}Request {
    {{name_validate}}
    pub name: Option<String>,
    {{desc_validate}}
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

impl Create{{struct_name}}Request {
    pub fn validate(&self) -> Result<(), String> {
        {{create_validate_body}}
        Ok(())
    }
}

impl Update{{struct_name}}Request {
    pub fn validate(&self) -> Result<(), String> {
        {{update_validate_body}}
        Ok(())
    }
}
