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

	"{{module}}/internal/config"
	{{#if database}}
	"{{module}}/internal/database"
	{{/if}}
	"{{module}}/internal/logger"
	"{{module}}/internal/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	zapLogger := logger.NewLogger(cfg.Env)
	defer zapLogger.Sync()

	{{#if database}}
	// Initialize database
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		zapLogger.Fatal("Failed to connect to database", zap.Error(err))
	}

	// Auto-migrate database schemas
	if err := database.Migrate(db); err != nil {
		zapLogger.Fatal("Failed to migrate database", zap.Error(err))
	}
	{{/if}}

	app := server.NewServer(cfg, zapLogger{{#if database}}, db{{/if}})

	srv := &http.Server{
		Addr:         cfg.ServerAddress(),
		Handler:      app,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		zapLogger.Info("Starting server", zap.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("Server failed", zap.Error(err))
		}
	}()

	// Graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		zapLogger.Error("Graceful shutdown failed", zap.Error(err))
	}

	zapLogger.Info("Server exited")
}
