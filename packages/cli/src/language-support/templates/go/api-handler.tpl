package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"your-module/internal/models"
	"your-module/internal/services"
)

// {{structName}}Handler handles HTTP requests for {{serviceName}}
type {{structName}}Handler struct {
	service *services.{{structName}}Service
	logger  *zap.Logger
}

// New{{structName}}Handler creates a new {{serviceName}} handler
func New{{structName}}Handler(service *services.{{structName}}Service, logger *zap.Logger) *{{structName}}Handler {
	return &{{structName}}Handler{
		service: service,
		logger:  logger,
	}
}

// GetAll handles GET /{{packageName}}
func (h *{{structName}}Handler) GetAll(c *gin.Context) {
	h.logger.Info("Fetching all {{serviceName}} items")

	items, err := h.service.GetAll(c.Request.Context())
	if err != nil {
		h.logger.Error("Failed to fetch {{serviceName}} items", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

// GetByID handles GET /{{packageName}}/:id
func (h *{{structName}}Handler) GetByID(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	h.logger.Info("Fetching {{serviceName}} by ID", zap.Uint64("id", id))

	item, err := h.service.GetByID(c.Request.Context(), uint(id))
	if err != nil {
		if err == services.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "{{serviceName}} not found"})
			return
		}
		h.logger.Error("Failed to fetch {{serviceName}}", zap.Error(err), zap.Uint64("id", id))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

// Create handles POST /{{packageName}}
func (h *{{structName}}Handler) Create(c *gin.Context) {
	var req models.Create{{structName}}Request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Creating {{serviceName}}", zap.Any("payload", req))

	item, err := h.service.Create(c.Request.Context(), req)
	if err != nil {
		h.logger.Error("Failed to create {{serviceName}}", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": item})
}

// Update handles PUT /{{packageName}}/:id
func (h *{{structName}}Handler) Update(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var req models.Update{{structName}}Request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Updating {{serviceName}}", zap.Uint64("id", id), zap.Any("payload", req))

	item, err := h.service.Update(c.Request.Context(), uint(id), req)
	if err != nil {
		if err == services.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "{{serviceName}} not found"})
			return
		}
		h.logger.Error("Failed to update {{serviceName}}", zap.Error(err), zap.Uint64("id", id))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

// Delete handles DELETE /{{packageName}}/:id
func (h *{{structName}}Handler) Delete(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	h.logger.Info("Deleting {{serviceName}}", zap.Uint64("id", id))

	if err := h.service.Delete(c.Request.Context(), uint(id)); err != nil {
		if err == services.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "{{serviceName}} not found"})
			return
		}
		h.logger.Error("Failed to delete {{serviceName}}", zap.Error(err), zap.Uint64("id", id))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
