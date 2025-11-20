package logger

import (
	"go.uber.org/zap"
)

// NewLogger configures a zap logger with production defaults
func NewLogger() (*zap.Logger, error) {
	cfg := zap.NewProductionConfig()
	cfg.Encoding = "json"
	cfg.EncoderConfig.TimeKey = "timestamp"
	return cfg.Build()
}
