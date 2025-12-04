package services

import (
	"context"
	"errors"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"your-module/internal/models"
)

var (
	// ErrNotFound is returned when a resource is not found
	ErrNotFound = errors.New("resource not found")
	
	// ErrConflict is returned when a resource conflicts with existing data
	ErrConflict = errors.New("resource conflict")
)

// {{structName}}Service provides business logic for {{name}} operations
type {{structName}}Service struct {
	db     *gorm.DB
	logger *zap.Logger
}

// New{{structName}}Service creates a new {{name}} service
func New{{structName}}Service(db *gorm.DB, logger *zap.Logger) *{{structName}}Service {
	return &{{structName}}Service{
		db:     db,
		logger: logger,
	}
}

// GetAll retrieves all {{name}} items
func (s *{{structName}}Service) GetAll(ctx context.Context) ([]*models.{{structName}}, error) {
	var items []*models.{{structName}}
	
	if err := s.db.WithContext(ctx).Find(&items).Error; err != nil {
		s.logger.Error("Failed to fetch all {{name}} items", zap.Error(err))
		return nil, err
	}

	return items, nil
}

// GetByID retrieves a {{name}} by ID
func (s *{{structName}}Service) GetByID(ctx context.Context, id uint) (*models.{{structName}}, error) {
	var item models.{{structName}}
	
	if err := s.db.WithContext(ctx).First(&item, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		s.logger.Error("Failed to fetch {{name}}", zap.Error(err), zap.Uint("id", id))
		return nil, err
	}

	return &item, nil
}

// Create creates a new {{name}}
func (s *{{structName}}Service) Create(ctx context.Context, req *models.Create{{structName}}Request) (*models.{{structName}}, error) {
	item := &models.{{structName}}{
		Name:        req.Name,
		Description: req.Description,
		IsActive:    true,
	}

	if err := s.db.WithContext(ctx).Create(item).Error; err != nil {
		s.logger.Error("Failed to create {{name}}", zap.Error(err))
		return nil, err
	}

	return item, nil
}

// Update updates an existing {{name}}
func (s *{{structName}}Service) Update(ctx context.Context, id uint, req *models.Update{{structName}}Request) (*models.{{structName}}, error) {
	var item models.{{structName}}
	
	if err := s.db.WithContext(ctx).First(&item, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	// Update fields
	if req.Name != "" {
		item.Name = req.Name
	}
	if req.Description != nil {
		item.Description = req.Description
	}
	if req.IsActive != nil {
		item.IsActive = *req.IsActive
	}

	if err := s.db.WithContext(ctx).Save(&item).Error; err != nil {
		s.logger.Error("Failed to update {{name}}", zap.Error(err), zap.Uint("id", id))
		return nil, err
	}

	return &item, nil
}

// Delete deletes a {{name}} by ID
func (s *{{structName}}Service) Delete(ctx context.Context, id uint) error {
	result := s.db.WithContext(ctx).Delete(&models.{{structName}}{}, id)
	if result.Error != nil {
		s.logger.Error("Failed to delete {{name}}", zap.Error(result.Error), zap.Uint("id", id))
		return result.Error
	}

	if result.RowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}
