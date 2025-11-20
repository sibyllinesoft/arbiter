from pydantic import BaseModel


class {{schema_class}}(BaseModel):
    id: int
    name: str

    class Config:
        orm_mode = True
