"""Business logic for {{name}}"""
from typing import List, Optional

class {{className}}Service:
    def __init__(self):
        # initialize repositories or dependencies here
        pass

    async def list_{{name}}(self) -> List[dict]:
        return []

    async def get_{{name}}(self, id: int) -> Optional[dict]:
        return None

    async def create_{{name}}(self, payload: dict) -> dict:
        return payload

    async def update_{{name}}(self, id: int, payload: dict) -> dict:
        return payload

    async def delete_{{name}}(self, id: int) -> None:
        return None
