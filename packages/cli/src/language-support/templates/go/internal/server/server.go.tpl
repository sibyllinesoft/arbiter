package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	{{#if hasDatabase}}"gorm.io/gorm"
	{{/if}}

	"{{moduleName}}/internal/config"
	"{{moduleName}}/internal/handlers"
	"{{moduleName}}/internal/middleware"
)

// Server represents the HTTP server
type Server struct {
	config *config.Config
	{{#if hasDatabase}}db     *gorm.DB
	{{/if}}logger *zap.Logger
	router *gin.Engine
}

// New creates a new server instance
func New(cfg *config.Config, {{serverDbParam}}logger *zap.Logger) *http.Server {
	// Set gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create router
	router := gin.New()

	// Add middleware
	router.Use(middleware.LoggerMiddleware(logger))
	router.Use(middleware.CORSMiddleware())
	router.Use(gin.Recovery())

	// Health check
	router.GET("/health", handlers.HealthCheck)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Add your routes here
		// Example: routes.SetupUserRoutes(v1, userService, logger)
		v1.GET("/ping", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "pong"})
		})
	}

	return &http.Server{
		Addr:    cfg.Address,
		Handler: router,
	}
}
