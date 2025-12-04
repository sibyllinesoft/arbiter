from pydantic import BaseModel

class {{className}}Base(BaseModel):
    name: str
    description: str | None = None

class {{className}}Create({{className}}Base):
    pass

class {{className}}Update({{className}}Base):
    name: str | None = None

class {{className}}({{className}}Base):
    id: int

    class Config:
        orm_mode = True
