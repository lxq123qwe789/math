import socketio
import asyncio

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

BROADCAST_THROTTLE_SECONDS = 0.3
_pending_group_ids: set[int] = set()
_flush_task: asyncio.Task | None = None


async def _flush_data_updated():
    global _flush_task
    try:
        await asyncio.sleep(BROADCAST_THROTTLE_SECONDS)
        if not _pending_group_ids:
            return
        group_ids = sorted(_pending_group_ids)
        _pending_group_ids.clear()
        await sio.emit("data_updated", {"group_ids": group_ids})
    finally:
        _flush_task = None

    if _pending_group_ids:
        _flush_task = asyncio.create_task(_flush_data_updated())


async def broadcast_data_updated(group_id: int):
    global _flush_task
    _pending_group_ids.add(group_id)
    if _flush_task is None or _flush_task.done():
        _flush_task = asyncio.create_task(_flush_data_updated())
