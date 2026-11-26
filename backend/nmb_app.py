"""VPN identity checks around the pinned Open WebUI ASGI app and Socket.IO handlers."""

import asyncio
import hmac
import json
import os
import re
from pathlib import Path
from urllib.parse import quote

from open_webui.main import app as webui
from open_webui.models.config import Config
from open_webui.models.users import Users
from open_webui.utils.images.connections import IMAGE_CONNECTIONS_CONFIG_KEY, PUBLIC_ACCESS_GRANTS, normalize_image_connection
from open_webui.socket.main import sio
from open_webui.utils.auth import get_verified_user_by_token
from starlette.datastructures import Headers
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse

EMAIL = re.compile(r"agent-[0-9a-f]{24}@nmb\.internal")
PROXY_KEY = os.environ["NMB_CHAT_PROXY_KEY"].encode()
ORIGIN = os.environ["WEBUI_URL"]
SOCKET_PATH = "/ws/socket.io"
SIGNIN = "/api/v1/auths/signin"
OPEN_PATHS = {"/api/config", SIGNIN}
AUTH_PATHS = {"/api/v1/auths", SIGNIN, "/api/v1/auths/signout", "/api/v1/auths/update/timezone",
              "/api/v1/auths/update/profile"}
ADMIN_EMAIL = os.environ["WEBUI_ADMIN_EMAIL"]
ACTIVE = Path("/run/nmb-identities/active-agents")
PROFILE_NAMES = ACTIVE.with_name("profile-names.json")

if os.environ.get("ENABLE_IMAGE_GENERATION", "").lower() == "true":
    Config.DEFAULTS[IMAGE_CONNECTIONS_CONFIG_KEY] = [normalize_image_connection({
        "id": "subscriptions", "name": "Подписки", "type": "openai",
        "url": os.environ["OPENAI_API_BASE_URLS"], "key": os.environ["OPENAI_API_KEYS"],
        "config": {"access_grants": PUBLIC_ACCESS_GRANTS, "headers": {"X-NMB-Catalog": "media"},
                   "size": "auto", "capabilities": {"image_generation": True, "image_edit": True}},
    })]


async def apply_profile_name(scope, email):
    # The reconciler exports only verified profile names. Never accept the browser's value.
    header = b"x-nmb-profile-name"
    scope["headers"] = [(k, v) for k, v in scope["headers"] if k != header]
    try:
        name = json.loads(PROFILE_NAMES.read_text(encoding="utf-8")).get(email)
    except (FileNotFoundError, ValueError):
        return
    if not isinstance(name, str) or not name.strip():
        return
    scope["headers"].append((header, quote(name, safe="").encode("ascii")))
    user = await Users.get_user_by_email(email)
    if user and user.name != name:
        await Users.update_user_by_id(user.id, {"name": name})


def active(email):
    try:
        return email in ACTIVE.read_text(encoding="ascii").splitlines()
    except (OSError, UnicodeError):
        return False


async def valid_token(token, email):
    if not isinstance(token, str) or not token or len(token) > 8192:
        return False
    try:
        user = await get_verified_user_by_token(token, getattr(webui.state, "redis", None))
    except (ValueError, TypeError):
        return False
    return user is not None and user.role == "user" and user.email == email


def install_socket_binding():
    # Socket.IO's eager-accept mode announces connection before the auth callback completes.
    sio.always_connect = False
    handlers = sio.handlers["/"]
    original_connect = handlers["connect"]

    async def connect(sid, environ, auth=None):
        token = auth.get("token") if isinstance(auth, dict) else None
        email = environ["asgi.scope"]["nmb.email"]
        # The unmodified browser opens its socket before its first trusted sign-in.
        if token and not await valid_token(token, email):
            return False
        return await original_connect(sid, environ, auth)

    sio.on("connect", connect)

    def bind_join(event):
        original = handlers[event]

        async def join(sid, data):
            env = sio.get_environ(sid) or {}
            email = env.get("asgi.scope", {}).get("nmb.email")
            auth = data.get("auth") if isinstance(data, dict) else None
            if not isinstance(auth, dict) or not await valid_token(auth.get("token"), email):
                await sio.disconnect(sid)
                return
            return await original(sid, data)

        sio.on(event, join)

    for event in ("user-join", "join-channels", "note:join"):
        bind_join(event)


install_socket_binding()


async def deny(scope, receive, send, status=403):
    if scope["type"] == "websocket":
        await send({"type": "websocket.close", "code": 1008})
    else:
        await JSONResponse({"detail": "VPN identity required"}, status,
                           headers={"Cache-Control": "no-store"})(scope, receive, send)


async def app(scope, receive, send):
    if scope["type"] not in {"http", "websocket"}:
        return await webui(scope, receive, send)
    path = scope["path"].rstrip("/") or "/"
    if path == "/health" and scope.get("method") == "GET":
        return await webui(scope, receive, send)
    headers = Headers(scope=scope)
    keys = headers.getlist("x-nmb-proxy-key")
    emails = headers.getlist("x-vpn-user")
    if (len(keys) != 1 or not hmac.compare_digest(keys[0].encode(), PROXY_KEY)
            or len(emails) != 1 or not EMAIL.fullmatch(emails[0])):
        return await deny(scope, receive, send)
    email = emails[0]
    scope["nmb.email"] = email
    if not active(email) or ("origin" in headers and headers.getlist("origin") != [ORIGIN]):
        return await deny(scope, receive, send)
    # The API is private, including optional tools' websocket transports.
    if scope["type"] == "websocket":
        if path != SOCKET_PATH:
            return await deny(scope, receive, send)
    elif path == SOCKET_PATH or (path.startswith("/api/v1/auths/") and path not in AUTH_PATHS):
        return await deny(scope, receive, send)
    elif scope.get("method") not in ("GET", "HEAD", "OPTIONS") and headers.get("origin") != ORIGIN:
        return await deny(scope, receive, send)

    # Do not expose the proxy credential to Open WebUI handlers or upstream integrations.
    scope["headers"] = [(k, v) for k, v in scope["headers"] if k not in
                        {b"x-nmb-proxy-key", b"x-api-key", b"x-openwebui-user-jwt"}]
    if scope["type"] == "websocket":
        async def checked_receive():
            while active(email):
                try:
                    return await asyncio.wait_for(receive(), timeout=10)
                except TimeoutError:
                    continue
            await send({"type": "websocket.close", "code": 1008})
            return {"type": "websocket.disconnect", "code": 1008}

        return await webui(scope, checked_receive, send)

    cookies = Request(scope).cookies
    document = scope.get("method") == "GET" and headers.get("sec-fetch-dest") == "document"
    if document and cookies.get("nmb_chat_profile") != email:
        # Reset browser-local history/UI state on a profile change, before the SPA reads it.
        response = HTMLResponse(
            '<!doctype html><meta charset=utf-8><script>localStorage.clear();'
            'sessionStorage.clear();location.replace(location.href)</script>',
            headers={"Cache-Control": "no-store", "Clear-Site-Data": '"cache", "storage"'},
        )
        response.set_cookie("nmb_chat_profile", email, secure=True, httponly=True, samesite="strict")
        response.delete_cookie("token", secure=True, httponly=True, samesite="strict")
        return await response(scope, receive, send)

    public_files = path.startswith(("/_app/", "/static/", "/audio/"))
    if public_files:
        scope["headers"] = [(k, v) for k, v in scope["headers"] if k not in (b"cookie", b"authorization")]
    else:
        auth = headers.get("authorization")
        tokens = {cookies.get("token", "")} - {""}
        if auth:
            scheme, _, value = auth.partition(" ")
            if scheme.lower() != "bearer":
                return await deny(scope, receive, send, 401)
            tokens.add(value)
        strip_credentials = path == SIGNIN
        if not strip_credentials:
            for token in tokens:
                if not await valid_token(token, email):
                    if path not in OPEN_PATHS:
                        return await deny(scope, receive, send, 401)
                    # The browser needs public config to sign in with its new VPN profile.
                    strip_credentials = True
                    break
        if strip_credentials:
            scope["headers"] = [(k, v) for k, v in scope["headers"]
                                if k not in (b"cookie", b"authorization")]
    if path in (SIGNIN, "/api/v1/auths"):
        await apply_profile_name(scope, email)
    if path == SIGNIN:
        # The upstream bootstrap logs initialization errors and otherwise continues.
        # Refuse ordinary enrollments unless the separate administrator already exists.
        admin = await Users.get_user_by_email(ADMIN_EMAIL)
        if admin is None or admin.role != "admin":
            return await deny(scope, receive, send, 503)

    async def private_send(message):
        if message["type"] == "http.response.start" and not public_files:
            message = dict(message)
            message["headers"] = [(k, v) for k, v in message.get("headers", []) if k != b"cache-control"]
            message["headers"].append((b"cache-control", b"private, no-store"))
        await send(message)

    return await webui(scope, receive, private_send)
