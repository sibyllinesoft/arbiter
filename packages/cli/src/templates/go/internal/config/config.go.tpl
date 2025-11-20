package config

import (
	"os"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all application configuration values
type Config struct {
	Address     string        `json:"address" yaml:"address"`
	Env         string        `json:"env" yaml:"env"`
	ReadTimeout time.Duration `json:"read_timeout" yaml:"read_timeout"`
	WriteTimeout time.Duration `json:"write_timeout" yaml:"write_timeout"`
	IdleTimeout time.Duration `json:"idle_timeout" yaml:"idle_timeout"`
	{{#hasDatabase}}DatabaseURL string        `json:"database_url" yaml:"database_url"`{{/hasDatabase}}
}

// Load reads configuration from environment variables (with .env support)
func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		Address:      getEnv("APP_ADDRESS", ":8080"),
		Env:          getEnv("APP_ENV", "development"),
		ReadTimeout:  mustParseDuration(getEnv("APP_READ_TIMEOUT", "15s")),
		WriteTimeout: mustParseDuration(getEnv("APP_WRITE_TIMEOUT", "15s")),
		IdleTimeout:  mustParseDuration(getEnv("APP_IDLE_TIMEOUT", "60s")),
		{{#hasDatabase}}DatabaseURL:  getEnv("DATABASE_URL", "postgres://postgres:password@localhost:5432/{{moduleName}}?sslmode=disable"),{{/hasDatabase}}
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func mustParseDuration(value string) time.Duration {
	d, err := time.ParseDuration(value)
	if err != nil {
		return 15 * time.Second
	}
	return d
}
