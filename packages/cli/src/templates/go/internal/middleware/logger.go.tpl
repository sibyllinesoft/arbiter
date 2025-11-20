package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// LoggerMiddleware creates a gin middleware for logging requests
func LoggerMiddleware(logger *zap.Logger) gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		logger.Info("Request",
			zap.String("client_ip", param.ClientIP),
			zap.String("method", param.Method),
			zap.String("path", param.Path),
			zap.Int("status", param.StatusCode),
			zap.Duration("latency", param.Latency),
			zap.String("user_agent", param.Request.UserAgent()),
			zap.String("error", param.ErrorMessage),
		)
		return ""
	})
}
