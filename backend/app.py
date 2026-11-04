"""FastAPI backend that signs in to https://203.135.2.93/Login.aspx (SPA).

Run:  uvicorn app:app --host 127.0.0.1 --port 8000
Env:  SPA_BASE_URL, SPA_USERNAME, SPA_PASSWORD (optional defaults)
"""
from __future__ import annotations

import os
import secrets
import threading
import time
from typing import Any, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from spa_client import SPAClient, SPAError

DEFAULT_USERNAME = os.getenv("SPA_USERNAME", "District.bahawalnagar")
DEFAULT_PASSWORD = os.getenv("SPA_PASSWORD", "SPA@1139")
SESSION_TTL_SECONDS = 30 * 60

app = FastAPI(title="SPA Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

_lock = threading.Lock()
_sessions: dict[str, dict[str, Any]] = {
    # token: {"client": SPAClient, "user": str, "created": float}
}


class LoginRequest(BaseModel):
    username: str = ""
    password: str = ""


def _cleanup_expired() -> None:
    now = time.time()
    for token in [
        t
        for t, s in _sessions.items()
        if now - s["created"] > SESSION_TTL_SECONDS
    ]:
        _sessions.pop(token, None)


def _create_session(username: str, password: str) -> tuple[str, SPAClient]:
    client = SPAClient(username=username, password=password)
    client.login()
    token = secrets.token_urlsafe(32)
    with _lock:
        _cleanup_expired()
        _sessions[token] = {
            "client": client,
            "user": username,
            "created": time.time(),
        }
    return token, client


def _get_client(authorization: Optional[str]) -> SPAClient:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Missing bearer token. Login via POST /api/login and send "Authorization: Bearer <token>".',
        )
    token = authorization.removeprefix("Bearer ").strip()
    with _lock:
        entry = _sessions.get(token)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown or expired token"
        )
    return entry["client"]


@app.post("/api/login")
def login(body: LoginRequest) -> dict[str, Any]:
    username = body.username or DEFAULT_USERNAME
    password = body.password or DEFAULT_PASSWORD
    try:
        token, client = _create_session(username, password)
    except SPAError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    return {
        "status": "success",
        "message": "Logged in to SPA",
        "token": token,
        "token_type": "bearer",
        "username": username,
        "landing_url": client.last_login.get("landing_url"),
    }


@app.get("/api/session/check")
def check(authorization: str = Header(default="")) -> dict[str, Any]:
    client = _get_client(authorization)
    return {"logged_in": client.is_logged_in()}


@app.get("/api/session/cookies")
def cookies(authorization: str = Header(default="")) -> dict[str, Any]:
    client = _get_client(authorization)
    return {"cookies": client.session.cookies.get_dict()}


@app.post("/api/logout")
def logout(authorization: str = Header(default="")) -> dict[str, Any]:
    token = authorization.removeprefix("Bearer ").strip()
    with _lock:
        entry = _sessions.pop(token, None)
    if entry is None:
        return {"status": "already_logged_out"}
    entry["client"].logout()
    return {"status": "success", "message": "SPA session terminated"}


@app.post("/api/logout/all")
def logout_all() -> dict[str, Any]:
    with _lock:
        tokens = list(_sessions.keys())
        clients = [_sessions.pop(t)["client"] for t in tokens]
    for c in clients:
        c.logout()
    return {"status": "success", "terminated": len(clients)}


@app.get("/api/pages/{path:path}")
def fetch_page(path: str, authorization: str = Header(default="")) -> dict[str, Any]:
    client = _get_client(authorization)
    try:
        return client.get_page(path)
    except SPAError as exc:
        code = 401 if "not logged in" in str(exc).lower() else 502
        raise HTTPException(status_code=code, detail=str(exc))


@app.get("/api/complaints")
def complaints(authorization: str = Header(default="")) -> dict[str, Any]:
    return fetch_page("MembersArea/Complaints/ComplaintList.aspx", authorization)


@app.get("/api/complaints-data")
def complaints_data(
    authorization: str = Header(default=""),
    start: Optional[str] = None,
    end: Optional[str] = None,
    town: Optional[str] = None,
    zone: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
) -> dict[str, Any]:
    """Complaint records via the page's getComplaintList WebMethod.
    start/end are mm/dd/yyyy strings (default: last 30 days).
    town: complaint_town_id filter (e.g., 'Haroonabad')
    zone: complaint_zone_id filter
    status: complaint_status_id filter
    category: complaint_category_id filter"""
    import datetime

    client = _get_client(authorization)
    end_d = (
        datetime.datetime.strptime(end, "%m/%d/%Y").date()
        if end
        else datetime.date.today()
    )
    start_d = (
        datetime.datetime.strptime(start, "%m/%d/%Y").date()
        if start
        else end_d - datetime.timedelta(days=30)
    )
    filters = {}
    if town:
        filters["complaint_town_id"] = town
    if zone:
        filters["complaint_zone_id"] = zone
    if status:
        filters["complaint_status_id"] = status
    if category:
        filters["complaint_category_id"] = category
    try:
        rows = client.get_complaints(
            start_d.strftime("%m/%d/%Y"), end_d.strftime("%m/%d/%Y"), filters
        )
    except SPAError as exc:
        code = 401 if "not logged in" in str(exc).lower() else 502
        raise HTTPException(status_code=code, detail=str(exc))
    return {
        "count": len(rows),
        "start": start_d.isoformat(),
        "end": end_d.isoformat(),
        "rows": rows,
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "time": str(int(time.time()))}

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import pathlib

_FRONTEND_DIST = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(_FRONTEND_DIST / "assets")), name="assets")
    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        # Serve index.html for any non-API, non-asset route (SPA client-side routing)
        candidate = _FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(_FRONTEND_DIST / "index.html"))