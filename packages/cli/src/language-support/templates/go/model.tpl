package models

import (
	"time"

	"gorm.io/gorm"
)

// {{structName}} represents the {{name}} domain model
type {{structName}} struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `json:"name"`
	Description *string        `json:"description,omitempty"`
	IsActive    bool           `json:"isActive"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// Create{{structName}}Request defines payload for creating {{name}}
type Create{{structName}}Request struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description,omitempty"`
}

// Update{{structName}}Request defines payload for updating {{name}}
type Update{{structName}}Request struct {
	Name        string  `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	IsActive    *bool   `json:"isActive,omitempty"`
}
