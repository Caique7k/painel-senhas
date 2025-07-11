from fastapi import FastAPI, Form
from fastapi import Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from gtts import gTTS
import os
import uuid
import time
import hashlib
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # endereço do frontend que pode acessar
    allow_credentials=True,
    allow_methods=["*"],   # permite todos os métodos (GET, POST, etc)
    allow_headers=["*"],   # permite todos os headers
)

AUDIO_DIR = "app/static"
os.makedirs(AUDIO_DIR, exist_ok=True)

chamadas_recentes = []
historico_chamadas = []

async def apagar_audio_apos_3_minutos(path: str):
    print(f"[DEBUG] Agendado para apagar em 3 minutos: {path}")
    await asyncio.sleep(180)
    if os.path.exists(path):
        try:
            os.remove(path)
            print(f"[DEBUG] Áudio removido com sucesso: {path}")
        except Exception as e:
            print(f"[DEBUG] Erro ao remover áudio: {e}")
    else:
        print(f"[DEBUG] Arquivo já não existia: {path}")


@app.get("/")
async def root():
    return {"message": "API do painel de senhas rodando!"}

@app.post("/chamar")
async def chamar_paciente(
    nome_paciente: str = Form(...),
    consultorio: str = Form(...),
    setor: str = Form(...)
):
    global chamadas_recentes, historico_chamadas
    agora = time.time()
    consultorio_normalizado = consultorio.strip().lower()

    # Contar somente chamadas dos últimos 3 minutos
    historico_chamadas[:] = [
        c for c in historico_chamadas if agora - c["timestamp"] < 180
    ]

    chamadas_anteriores = [
        c for c in historico_chamadas
        if c["paciente"] == nome_paciente and c["consultorio"].strip().lower() == consultorio_normalizado
    ]

    chamada_num = len(chamadas_anteriores) + 1

    if chamada_num > 3:
        return {"error": "Paciente já foi chamado 3 vezes nos últimos minutos. Chame outro paciente."}

    # Gera o áudio
    texto = (
        f"{nome_paciente}, dirigir-se à {consultorio} (chamada número {chamada_num})"
        if chamada_num > 1 else
        (f"{nome_paciente}, dirigir-se à {consultorio}"
         if consultorio_normalizado == "triagem"
         else f"{nome_paciente}, dirigir-se ao {consultorio}")
    )

    filename = f"{uuid.uuid4()}.mp3"
    filepath = os.path.join(AUDIO_DIR, filename)

    tts = gTTS(text=texto, lang="pt-br")
    tts.save(filepath)
    asyncio.create_task(apagar_audio_apos_3_minutos(filepath))

    chamada = {
        "id": str(uuid.uuid4()),
        "paciente": nome_paciente,
        "consultorio": consultorio,
        "audio_url": f"/static/{filename}",
        "timestamp": agora,
        "setor": setor,
        "numero_chamada": chamada_num,
    }

    # Remove chamadas expiradas do painel
    chamadas_recentes[:] = [
        c for c in chamadas_recentes if agora - c["timestamp"] < 180
    ]

    # Substitui qualquer paciente anterior do mesmo consultório
    chamadas_recentes[:] = [
        c for c in chamadas_recentes
        if c["consultorio"].strip().lower() != consultorio_normalizado
    ]

    chamadas_recentes.append(chamada)
    historico_chamadas.append(chamada)

    return chamada


@app.get("/ultimas-chamadas")
async def ultimas_chamadas(setor: str = Query(...)):
    agora = time.time()
    # Retorna só chamadas com menos de 180 segundos
    validas = [
    c for c in chamadas_recentes
    if agora - c["timestamp"] < 180 and c["setor"] == setor
]
    return validas

@app.get("/static/{filename}")
async def servir_audio(filename: str):
    path = os.path.join(AUDIO_DIR, filename)
    if os.path.isfile(path):
        return FileResponse(path, media_type="audio/mpeg")
    return {"error": "Arquivo não encontrado"}
