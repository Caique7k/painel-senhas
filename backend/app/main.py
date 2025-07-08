from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from gtts import gTTS
import os
import uuid
import time
import hashlib

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

chamadas_recentes = []

@app.get("/")
async def root():
    return {"message": "API do painel de senhas rodando!"}

@app.post("/chamar")
async def chamar_paciente(nome_paciente: str = Form(...), consultorio: str = Form(...)):
    texto = f"Paciente {nome_paciente}, dirigir-se ao {consultorio}"

    id_raw = f"{nome_paciente}-{consultorio}"
    id_hash = hashlib.md5(id_raw.encode("utf-8")).hexdigest()

    global chamadas_recentes

    # Verifica se já existe chamada igual
    chamada_existente = next((c for c in chamadas_recentes if c["id"] == id_hash), None)
    if chamada_existente:
        # Não gera áudio nem atualiza timestamp
        return chamada_existente

    # Se não existe, cria o áudio e registra
    filename = f"{uuid.uuid4()}.mp3"
    filepath = os.path.join(AUDIO_DIR, filename)

    tts = gTTS(text=texto, lang='pt-br')
    tts.save(filepath)

    chamada = {
        "id": id_hash,
        "paciente": nome_paciente,
        "consultorio": consultorio,
        "audio_url": f"/static/{filename}",
        "timestamp": time.time()
    }

    chamadas_recentes.append(chamada)

    # Remove chamadas expiradas (> 180s)
    agora = time.time()
    chamadas_recentes = [c for c in chamadas_recentes if agora - c["timestamp"] < 180]

    # Limita tamanho da lista
    if len(chamadas_recentes) > 10:
        chamadas_recentes.pop(0)

    return chamada

@app.get("/ultimas-chamadas")
async def ultimas_chamadas():
    agora = time.time()
    # Retorna só chamadas com menos de 180 segundos
    validas = [c for c in chamadas_recentes if agora - c["timestamp"] < 180]
    return validas

@app.get("/static/{filename}")
async def servir_audio(filename: str):
    path = os.path.join(AUDIO_DIR, filename)
    if os.path.isfile(path):
        return FileResponse(path, media_type="audio/mpeg")
    return {"error": "Arquivo não encontrado"}
