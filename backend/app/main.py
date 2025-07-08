from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from gtts import gTTS
import os
import uuid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # endereço do frontend que pode acessar
    allow_credentials=True,
    allow_methods=["*"],   # permite todos os métodos (GET, POST, etc)
    allow_headers=["*"],   # permite todos os headers
)

AUDIO_DIR = "app/static"
os.makedirs(AUDIO_DIR, exist_ok=True)

@app.get("/")
async def root():
    return {"message": "API do painel de senhas rodando!"}

@app.post("/chamar")
async def chamar_paciente(nome_paciente: str = Form(...), consultorio: str = Form(...)):
    texto = f"Paciente {nome_paciente}, dirigir-se ao {consultorio}"
    filename = f"{uuid.uuid4()}.mp3"
    filepath = os.path.join(AUDIO_DIR, filename)

    tts = gTTS(text=texto, lang='pt-br')
    tts.save(filepath)

    return {"audio_url": f"/static/{filename}", "mensagem": texto}

@app.get("/static/{filename}")
async def servir_audio(filename: str):
    path = os.path.join(AUDIO_DIR, filename)
    if os.path.isfile(path):
        return FileResponse(path, media_type="audio/mpeg")
    return {"error": "Arquivo não encontrado"}
