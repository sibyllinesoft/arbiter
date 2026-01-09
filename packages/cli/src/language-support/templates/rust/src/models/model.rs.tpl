use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
{{extra_imports}}
{{from_row_import}}

/// {{struct_name}} model
#[derive(Debug, Clone, Serialize, Deserialize{{from_row_derive}}{{validate_derive}})]
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
{{name_validate}}    pub name: String,
{{desc_validate}}    pub description: Option<String>,
}

/// Request payload for updating a {{struct_name}}
#[derive(Debug, Deserialize{{validate_derive}})]
pub struct Update{{struct_name}}Request {
{{name_validate}}    pub name: Option<String>,
{{desc_validate}}    pub description: Option<String>,
    pub is_active: Option<bool>,
}

impl {{struct_name}} {
    /// Create a new {{struct_name}} instance
    pub fn new(name: String, description: Option<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name,
            description,
            is_active: true,
            created_at: now,
            updated_at: now,
        }
    }

    /// Check if the {{struct_name}} is active
    pub fn is_active(&self) -> bool {
        self.is_active
    }

    /// Update the {{struct_name}} with new data
    pub fn update(&mut self, request: Update{{struct_name}}Request) {
        if let Some(name) = request.name {
            self.name = name;
        }
        if let Some(description) = request.description {
            self.description = Some(description);
        }
        if let Some(is_active) = request.is_active {
            self.is_active = is_active;
        }
        self.updated_at = Utc::now();
    }
}

{{create_validate_body}}

{{update_validate_body}}
