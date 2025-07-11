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
    global chamadas_recentes
    agora = time.time()

    # Remove chamadas expiradas (mais de 3 minutos) - atualiza lista in-place
    chamadas_recentes[:] = [
        c for c in chamadas_recentes if agora - c["timestamp"] < 180
    ]

    # Cria ID único para evitar duplicatas exatas
    id_raw = f"{nome_paciente}-{consultorio}-{setor}"
    id_hash = hashlib.md5(id_raw.encode("utf-8")).hexdigest()

    # Impede chamada duplicada
    if any(c["id"] == id_hash for c in chamadas_recentes):
        return {"error": "Essa chamada já foi realizada recentemente."}

    # Normaliza o nome do consultório para minúsculas e sem espaços extra
    consultorio_normalizado = consultorio.strip().lower()

    # Dicionário com chaves em minúsculas para facilitar a comparação
    LIMITES_POR_CONSULTORIO = {
        "triagem": 1,
        "consultório 1": 1,
        "consultório 2": 1,
        "consultório 3": 1,
        # adicione outros consultórios e seus limites aqui
    }

    limite = LIMITES_POR_CONSULTORIO.get(consultorio_normalizado, 1)

    chamadas_mesmo_consultorio = [
        c for c in chamadas_recentes if c["consultorio"].strip().lower() == consultorio_normalizado
    ]

    if consultorio_normalizado == "triagem":
        # Remove chamadas anteriores da triagem para substituir
        chamadas_recentes[:] = [
            c for c in chamadas_recentes if c["consultorio"].strip().lower() != "triagem"
        ]
    else:
        # Verifica limite para outros consultórios
        if len(chamadas_mesmo_consultorio) >= limite:
            return {
                "error": f"O limite de {limite} pacientes ativos no {consultorio} foi atingido. Aguarde 3 minutos."
            }

    # Gera o áudio
    texto = (
        f"{nome_paciente}, dirigir-se à {consultorio}"
        if consultorio_normalizado == "triagem"
        else f"{nome_paciente}, dirigir-se ao {consultorio}"
    )
    filename = f"{uuid.uuid4()}.mp3"
    filepath = os.path.join(AUDIO_DIR, filename)

    tts = gTTS(text=texto, lang="pt-br")
    tts.save(filepath)
    asyncio.create_task(apagar_audio_apos_3_minutos(filepath))

    chamada = {
        "id": id_hash,
        "paciente": nome_paciente,
        "consultorio": consultorio,
        "audio_url": f"/static/{filename}",
        "timestamp": agora,
        "setor": setor,
    }

    chamadas_recentes.append(chamada)

    # (Opcional) limita a lista geral a 10 chamadas
    if len(chamadas_recentes) > 10:
        chamadas_recentes.pop(0)

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
