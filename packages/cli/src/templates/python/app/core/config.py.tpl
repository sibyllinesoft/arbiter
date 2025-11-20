from functools import lru_cache
from pydantic import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "{{project_name}}"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "{{description}}"
    ENV: str = "development"
{{databaseSetting}}    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
