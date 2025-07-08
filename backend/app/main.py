from fastapi import FastAPI, Form
from fastapi.responses import FileResponse
from gtts import gTTS
import os
import uuid

app = FastAPI()

AUDIO_DIR = "app/static"
os.makedirs(AUDIO_DIR, exist_ok=True)

@app.get("/")
async def root():
    return {"message": "API do painel de senhas rodando!"}

@app.post("/chamar")
async def chamar_paciente(nome_paciente: str = Form(...), consultorio: str = Form(...)):
    texto = f"Paciente {nome_paciente}, dirigir-se ao consultório {consultorio}"
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
