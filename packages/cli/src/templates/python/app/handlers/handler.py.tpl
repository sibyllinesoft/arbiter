"""
{{resource_name}} Handler
HTTP request handlers for {{resource_name}}
"""
from fastapi import HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Any
{{db_import}}
{{schema_import}}
from app.services.{{service_module}}_service import {{service_instance}}
import logging

logger = logging.getLogger(__name__)


class {{handler_class}}:
    """Handler class for {{resource_name}} HTTP operations"""

    async def handle_get_all(self{{db_dependency}}) -> List[Any]:
        """Handle GET request for all {{resource_name}} items"""
        try:
            return await {{service_instance}}.get_all({{db_argument}})
        except Exception as e:
            logger.error(f"Error fetching all {{resource_name}}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def handle_get_by_id(self, item_id: int{{db_dependency}}) -> Any:
        """Handle GET request for {{resource_name}} by ID"""
        try:
            item = await {{service_instance}}.get_by_id(item_id{{db_argument}})
            if not item:
                raise HTTPException(status_code=404, detail="{{resource_name}} not found")
            return item
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching {{resource_name}} {item_id}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def handle_create(self, item_data: Any{{db_dependency}}) -> Any:
        """Handle POST request to create {{resource_name}}"""
        try:
            return await {{service_instance}}.create(item_data{{db_argument}})
        except Exception as e:
            logger.error(f"Error creating {{resource_name}}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def handle_update(self, item_id: int, item_data: Any{{db_dependency}}) -> Any:
        """Handle PUT request to update {{resource_name}}"""
        try:
            item = await {{service_instance}}.update(item_id, item_data{{db_argument}})
            if not item:
                raise HTTPException(status_code=404, detail="{{resource_name}} not found")
            return item
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating {{resource_name}} {item_id}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def handle_delete(self, item_id: int{{db_dependency}}) -> dict:
        """Handle DELETE request for {{resource_name}}"""
        try:
            success = await {{service_instance}}.delete(item_id{{db_argument}})
            if not success:
                raise HTTPException(status_code=404, detail="{{resource_name}} not found")
            return {"message": "{{resource_name}} deleted successfully"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting {{resource_name}} {item_id}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")


# Handler instance
{{handler_instance}} = {{handler_class}}()
