package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"

	"{{moduleName}}/internal/config"
	{{#hasDatabase}}"{{moduleName}}/internal/database"
	{{/hasDatabase}}"{{moduleName}}/internal/logger"
	"{{moduleName}}/internal/server"
)

func main() {
	// Initialize logger
	zapLogger, err := logger.NewLogger()
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer zapLogger.Sync()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		zapLogger.Fatal("Failed to load configuration", zap.Error(err))
	}

	{{#hasDatabase}}
	// Initialize database
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		zapLogger.Fatal("Failed to connect to database", zap.Error(err))
	}

	// Auto-migrate database schemas
	if err := database.Migrate(db); err != nil {
		zapLogger.Fatal("Failed to migrate database", zap.Error(err))
	}
	{{/hasDatabase}}

	// Initialize server
	srv := server.New(cfg, {{#hasDatabase}}db, {{/hasDatabase}}zapLogger)

	// Start server
	go func() {
		zapLogger.Info("Starting server", zap.String("address", cfg.Address))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	zapLogger.Info("Shutting down server...")

	// Give outstanding requests a deadline for completion
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		zapLogger.Fatal("Server forced to shutdown", zap.Error(err))
	}

	zapLogger.Info("Server exiting")
}
