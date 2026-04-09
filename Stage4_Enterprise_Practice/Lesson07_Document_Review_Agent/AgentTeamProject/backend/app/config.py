from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    deepseek_api_key: str = "sk-d10fbb1662294178bad56faf66dd60d7"
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-chat"
    database_url: str = "sqlite:///./contract_review.db"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    debug: bool = True
    secret_key: str = "dev-secret-key"
    storage_path: str = "./storage"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()


def get_llm():
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=settings.deepseek_model,
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
        temperature=0.1,
    )
