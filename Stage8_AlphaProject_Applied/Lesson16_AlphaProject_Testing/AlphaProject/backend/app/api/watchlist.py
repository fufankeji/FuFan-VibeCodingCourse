from collections.abc import Callable
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, status
from pydantic import BaseModel, Field

from app.config import settings
from app.errors import WatchlistError
from app.events.watchlist_events import publish_removed
from app.repositories.watchlist_repo import WatchlistRepo
from app.services.stock_basic_service import StockBasic, StockBasicService
from app.services.watchlist_service import WatchlistService


# ── request schemas ───────────────────────────────────────
class AddItemRequest(BaseModel):
    code: str = Field(min_length=1, max_length=10)
    name: str = Field(min_length=1, max_length=50)
    is_holding: bool = False
    group_id: int | None = None


class UpdateItemRequest(BaseModel):
    is_holding: bool | None = None
    group_id: int | None = None
    display_order: int | None = None


class GroupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=20)


# ── app factory (DI for tests) ────────────────────────────
def build_app(
    db_path: Path,
    fetcher: Callable[[], list[StockBasic]] | None = None,
    refresh_on_boot: bool = True,
    lifespan: Any = None,
) -> FastAPI:
    repo = WatchlistRepo(db_path)
    svc = WatchlistService(
        repo=repo,
        max_total=settings.MAX_WATCHLIST,
        max_holding=settings.MAX_HOLDING,
        max_group=settings.MAX_GROUP,
    )
    stock_svc = StockBasicService(fetcher=fetcher)
    if refresh_on_boot:
        stock_svc.refresh()

    app = FastAPI(title="AlphaProject · Watchlist", version="0.1.0", lifespan=lifespan)
    # Expose handles so production lifespan can schedule background tasks.
    app.state.svc = svc
    app.state.stock_svc = stock_svc

    def get_svc() -> WatchlistService:
        return svc

    def get_stock_svc() -> StockBasicService:
        return stock_svc

    @app.exception_handler(WatchlistError)
    async def watchlist_error(_request, exc: WatchlistError):
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": str(exc)}, status_code=400)

    @app.get("/watchlist")
    def list_items(s: WatchlistService = Depends(get_svc)):
        return s.snapshot()

    @app.post("/watchlist", status_code=status.HTTP_201_CREATED)
    def add_item(payload: AddItemRequest, s: WatchlistService = Depends(get_svc)):
        item = s.add(
            code=payload.code,
            name=payload.name,
            is_holding=payload.is_holding,
            group_id=payload.group_id,
        )
        return item.model_dump(mode="json")

    @app.delete("/watchlist/{code}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_item(code: str, s: WatchlistService = Depends(get_svc)):
        s.remove(code)
        publish_removed(code)

    @app.patch("/watchlist/{code}")
    def patch_item(code: str, payload: UpdateItemRequest, s: WatchlistService = Depends(get_svc)):
        # Use model_fields_set to distinguish "unset" from "explicit null"
        # (fixes D3: PATCH could not clear group_id to null).
        fields = {k: getattr(payload, k) for k in payload.model_fields_set}
        item = s.update(code, **fields)
        return item.model_dump(mode="json")

    @app.post("/watchlist/{code}:undo")
    def undo_item(code: str, s: WatchlistService = Depends(get_svc)):
        s.undo(code)
        return {"code": code, "restored": True}

    @app.get("/watchlist:search")
    def search(q: str, ss: StockBasicService = Depends(get_stock_svc)):
        return ss.search(q)

    # ── groups ─────────────────────────────────────────────
    @app.get("/watchlist/groups")
    def list_groups(s: WatchlistService = Depends(get_svc)):
        return [g.model_dump(mode="json") for g in s.list_groups()]

    @app.post("/watchlist/groups", status_code=status.HTTP_201_CREATED)
    def create_group(payload: GroupRequest, s: WatchlistService = Depends(get_svc)):
        return s.create_group(payload.name).model_dump(mode="json")

    @app.patch("/watchlist/groups/{group_id}")
    def rename_group(group_id: int, payload: GroupRequest, s: WatchlistService = Depends(get_svc)):
        return s.rename_group(group_id, payload.name).model_dump(mode="json")

    @app.delete("/watchlist/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_group(group_id: int, s: WatchlistService = Depends(get_svc)):
        s.delete_group(group_id)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app
