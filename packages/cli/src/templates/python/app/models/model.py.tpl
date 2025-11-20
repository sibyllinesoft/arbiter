from sqlalchemy import Column, Integer, String
from app.core.database import Base


class {{model_class}}(Base):
    __tablename__ = "{{table_name}}"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
