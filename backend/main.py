from contextlib import asynccontextmanager
from typing import Optional
import os
import re
import uuid
from fastapi import (
    FastAPI, UploadFile, File, HTTPException,
    Request, Header, Depends, Response, Cookie
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, EmailStr
from starlette.background import BackgroundTask
from dotenv import load_dotenv
from itsdangerous import URLSafeTimedSerializer

from stt import transcribe_audio
from tts import text_to_speech, text_to_wav
from chatbot import get_ai_reply
from database import (
    init_d1_db,
    init_sqlite_db,
    get_db,
    get_password_hash,
    verify_password,
    create_conversation,
    get_conversation,
    get_all_conversations,
    get_messages,
    add_message,
    delete_conversation,
    rename_conversation,
)

load_dotenv()

MAX_TTS_CHARS = 700


def _sanitize_header(text: str, max_len: int = 400) -> str:
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text)
    text = text.encode("ascii", errors="replace").decode("ascii")
    text = "".join(c for c in text if 32 <= ord(c) <= 126)
    return text[:max_len].strip()


def _truncate_for_tts(text: str, max_chars: int = MAX_TTS_CHARS) -> str:
    if not text:
        return ""
    text = text.strip()
    if len(text) <= max_chars:
        return text
    slice_ = text[:max_chars]
    for punct in (". ", "! ", "? "):
        idx = slice_.rfind(punct)
        if idx > max_chars // 2:
            return slice_[: idx + 1].strip()
    idx = slice_.rfind(" ")
    if idx > 0:
        return slice_[:idx].strip()
    return slice_.strip()


# ═════════════════════════════════════════════════════════════════════
#  APP LIFESPAN (Initialize Both DBs)
# ═════════════════════════════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_d1_db()      # Cloudflare D1 (Chat)
    init_sqlite_db()        # SQLite (Auth)
    yield


app = FastAPI(lifespan=lifespan)

# CORS must allow specific origins for credentials (cookies) to work
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Transcript", "X-Reply", "X-Conversation-Id"],
)


@app.get("/")
def home():
    return {"status": "Server running ✅"}


# ═════════════════════════════════════════════════════════════════════
#  AUTHENTICATION ROUTES
# ═════════════════════════════════════════════════════════════════════
SECRET_KEY = "your-super-secret-key-change-this"
serializer = URLSafeTimedSerializer(SECRET_KEY)


class RegisterModel(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginModel(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileModel(BaseModel):
    name: str
    email: EmailStr


def get_current_user(session_token: Optional[str] = Cookie(None)):
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        data = serializer.loads(session_token, max_age=86400)
        return data["email"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session")


@app.post("/api/auth/register")
def register(user: RegisterModel):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (user.email,))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="Email already exists")

    hashed_pw = get_password_hash(user.password)
    cursor.execute(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
        (user.name, user.email, hashed_pw),
    )
    db.commit()
    return {"message": "Registration successful. Please login."}


@app.post("/api/auth/login")
def login(user: LoginModel, response: Response):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (user.email,))
    db_user = cursor.fetchone()

    if not db_user or not verify_password(user.password, db_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = serializer.dumps({"email": user.email})

    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=86400,
    )
    return {"message": "Login successful"}


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie("session_token")
    return {"message": "Logged out successfully"}


@app.post("/api/auth/is-auth")
def is_auth(session_token: Optional[str] = Cookie(None)):
    if not session_token:
        return {"success": False}
    try:
        serializer.loads(session_token, max_age=86400)
        return {"success": True}
    except Exception:
        return {"success": False}


@app.get("/api/user/data")
def get_user_data(email: str = Depends(get_current_user)):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT name, email FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"userData": {"name": user["name"], "email": user["email"]}}


@app.put("/api/user/update")
def update_user_profile(
    data: UpdateProfileModel, email: str = Depends(get_current_user)
):
    db = get_db()
    cursor = db.cursor()

    if email != data.email:
        cursor.execute("SELECT * FROM users WHERE email = ?", (data.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="New email is already taken")

    cursor.execute(
        "UPDATE users SET name = ?, email = ? WHERE email = ?",
        (data.name, data.email, email),
    )
    db.commit()
    return {"success": True, "message": "Profile updated"}


# ═════════════════════════════════════════════════════════════════════
#  CHAT & STT/TTS ROUTES
# ═════════════════════════════════════════════════════════════════════
@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    temp_path = f"temp_{uuid.uuid4().hex}.webm"
    contents = await audio.read()
    if len(contents) < 100:
        raise HTTPException(status_code=400, detail="Audio too small")

    with open(temp_path, "wb") as f:
        f.write(contents)

    try:
        text = transcribe_audio(temp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return {"text": text}


class SpeakRequest(BaseModel):
    text: str
    lang: str = "en"


@app.post("/speak")
async def speak(request: SpeakRequest):
    audio_path = text_to_speech(request.text, request.lang)
    return FileResponse(
        path=audio_path, media_type="audio/mpeg", filename="reply.mp3"
    )


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None


@app.post("/chat")
async def chat(request: ChatRequest):
    if request.conversation_id:
        conv = await get_conversation(request.conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        title = request.message[:50] + ("..." if len(request.message) > 50 else "")
        conv = await create_conversation(title)

    if not conv or "id" not in conv:
        raise HTTPException(status_code=500, detail="Database error")

    conv_id = conv["id"]
    await add_message(conv_id, "user", request.message)

    db_messages = await get_messages(conv_id)
    messages_for_ai = [
        {"role": m["role"], "content": m["content"]} for m in db_messages
    ]
    reply = get_ai_reply(messages_for_ai)
    await add_message(conv_id, "assistant", reply)

    return {"reply": reply, "conversation_id": conv_id}


@app.get("/conversations")
async def list_conversations():
    return await get_all_conversations()


@app.get("/conversations/{conv_id}/messages")
async def get_conv_messages(conv_id: int):
    return await get_messages(conv_id)


@app.delete("/conversations/{conv_id}")
async def delete_conv(conv_id: int):
    await delete_conversation(conv_id)
    return {"deleted": True}


@app.patch("/conversations/{conv_id}/title")
async def rename_conv(conv_id: int, body: dict):
    title = body.get("title", "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    return await rename_conversation(conv_id, title)


# ─────────────────────────────────────────────────────
# DEVICE MANAGEMENT ROUTES (Web App)
# ─────────────────────────────────────────────────────
class DeviceCreateRequest(BaseModel):
    device_name: str

@app.post("/api/device/generate")
def generate_device_token(req: DeviceCreateRequest, email: str = Depends(get_current_user)):
    db = get_db()
    cursor = db.cursor()
    token = str(uuid.uuid4())
    
    cursor.execute(
        "INSERT INTO devices (user_email, device_name, device_token) VALUES (?, ?, ?)",
        (email, req.device_name, token)
    )
    db.commit()
    return {"token": token, "message": "Device paired successfully"}

@app.get("/api/device/list")
def list_devices(email: str = Depends(get_current_user)):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT id, device_name, device_token, created_at FROM devices WHERE user_email = ?", (email,))
    devices = cursor.fetchall()
    return {"devices": [dict(d) for d in devices]}

@app.delete("/api/device/{device_id}")
def delete_device(device_id: int, email: str = Depends(get_current_user)):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("DELETE FROM devices WHERE id = ? AND user_email = ?", (device_id, email))
    db.commit()
    return {"success": True}

# ═════════════════════════════════════════════════════════════════════
#  ESP32 ROUTES
# ═════════════════════════════════════════════════════════════════════
@app.post("/esp32/voice")
async def esp32_voice(
    request: Request,
    x_device_token: Optional[str] = Header(None, alias="X-Device-Token"),
    x_conversation_id: Optional[str] = Header(None, alias="X-Conversation-Id"),
    x_lang: str = Header("en", alias="X-Lang"),
):
    # 1. Verify the device token
    if not x_device_token:
        raise HTTPException(401, "Missing Device Token")
        
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT user_email FROM devices WHERE device_token = ?", (x_device_token,))
    device = cursor.fetchone()
    
    if not device:
        raise HTTPException(401, "Invalid or Unauthorized Device Token")
    
    audio_bytes = await request.body()
    if not audio_bytes or len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="No audio received or audio too short")

    temp_path = f"temp_esp32_{uuid.uuid4().hex}.wav"
    with open(temp_path, "wb") as f:
        f.write(audio_bytes)

    try:
        text = transcribe_audio(temp_path).strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    if not text:
        raise HTTPException(status_code=400, detail="Could not transcribe")

    conv_id_int = int(x_conversation_id) if x_conversation_id else None

    if conv_id_int:
        conv = await get_conversation(conv_id_int)
    else:
        conv = await create_conversation(text[:50])

    if not conv:
        raise HTTPException(status_code=500, detail="Database error")

    conv_id = conv["id"]
    await add_message(conv_id, "user", text)

    db_messages = await get_messages(conv_id)
    messages_for_ai = [
        {"role": m["role"], "content": m["content"]} for m in db_messages
    ]
    reply_full = get_ai_reply(messages_for_ai)
    reply_tts = _truncate_for_tts(reply_full, MAX_TTS_CHARS)

    await add_message(conv_id, "assistant", reply_full)

    wav_path = text_to_wav(reply_tts, x_lang)

    return FileResponse(
        path=wav_path,
        media_type="audio/wav",
        filename="reply.wav",
        headers={
            "X-Transcript": _sanitize_header(text, 200),
            "X-Reply": _sanitize_header(reply_tts, 180),
            "X-Conversation-Id": str(conv_id),
        },
        background=BackgroundTask(
            lambda p: os.remove(p) if os.path.exists(p) else None, wav_path
        ),
    )


@app.get("/esp32/last_reply")
async def esp32_last_reply(conv_id: int):
    conv = await get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs = await get_messages(conv_id)
    last_user, last_ai = "", ""

    for m in reversed(msgs):
        if not last_ai and m["role"] == "assistant":
            last_ai = m["content"]
        elif not last_user and m["role"] == "user":
            last_user = m["content"]
        if last_user and last_ai:
            break

    return JSONResponse(
        content={
            "conversation_id": conv_id,
            "transcript": last_user,
            "reply": last_ai,
        }
    )