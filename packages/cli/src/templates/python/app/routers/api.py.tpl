from fastapi import APIRouter

router = APIRouter(prefix="/{{resource_name}}", tags=["{{resource_name}}"])


@router.get("/")
async def list_items():
    return {"items": []}


@router.get("/{item_id}")
async def get_item(item_id: int):
    return {"id": item_id, "name": f"Item {item_id}"}
