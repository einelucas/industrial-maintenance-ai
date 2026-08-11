import logging
import sys


def configure_logging(app_env: str) -> None:
    """Configura logging estruturado simples para console.

    Em produção mantemos nível INFO; em desenvolvimento, DEBUG ajuda a
    depurar decisões do Predictor (ex.: qual implementação foi carregada).
    """
    level = logging.DEBUG if app_env != "production" else logging.INFO

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.handlers = [handler]


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
