from fastapi import Header, HTTPException, status

from app.core.config import get_settings


async def verify_internal_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Garante que a chamada vem do backend Next.js e não diretamente do browser.

    O Next.js é responsável por enviar o header `X-API-Key` com o valor de
    AI_SERVICE_API_KEY. Essa chave nunca deve ser exposta ao client (NEXT_PUBLIC_).
    """
    settings = get_settings()

    if x_api_key is None or x_api_key != settings.ai_service_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais de serviço inválidas ou ausentes.",
        )
