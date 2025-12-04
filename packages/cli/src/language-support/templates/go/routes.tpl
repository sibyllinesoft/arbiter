package routes

import (
	"github.com/gin-gonic/gin"

	"your-module/internal/handlers"
	"your-module/internal/services"
)

// Register{{structName}}Routes registers routes for {{name}}
func Register{{structName}}Routes(router *gin.Engine, service *services.{{structName}}Service) {
	handler := handlers.New{{structName}}Handler(service, nil)
	group := router.Group("/{{name | lower}}")

	group.GET("/", handler.GetAll)
	group.GET("/:id", handler.GetByID)
	group.POST("/", handler.Create)
	group.PUT("/:id", handler.Update)
	group.DELETE("/:id", handler.Delete)
}
