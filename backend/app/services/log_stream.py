import asyncio
import logging
from collections import deque

_LEVEL_MAP = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
}

_KNOWN_LOGGERS = (
    "uvicorn",
    "uvicorn.error",
    "uvicorn.access",
    "app.services.processor",
    "app.services.llm_handler",
    "app.services.paperless",
    "app.services.vision",
    "app.services.scheduler",
    "app.routers.config",
)


def apply_log_level(level_str: str) -> None:
    level = _LEVEL_MAP.get(level_str.upper(), logging.INFO)
    logging.getLogger().setLevel(level)
    for name in _KNOWN_LOGGERS:
        logging.getLogger(name).setLevel(level)

_buffer: deque[str] = deque(maxlen=500)
_subscribers: list[asyncio.Queue] = []


def get_history() -> list[str]:
    return list(_buffer)


async def _broadcast(line: str) -> None:
    _buffer.append(line)
    for q in _subscribers:
        await q.put(line)


async def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    _subscribers.append(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    try:
        _subscribers.remove(q)
    except ValueError:
        pass


class BroadcastHandler(logging.Handler):
    """Logging handler that feeds into the in-memory broadcast system."""

    def emit(self, record: logging.LogRecord) -> None:
        line = self.format(record)
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_broadcast(line))
        except RuntimeError:
            _buffer.append(line)  # no event loop (startup); just buffer
