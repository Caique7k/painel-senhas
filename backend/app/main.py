"""
Backend do Painel de Senhas - Santa Casa de Guaíra.

Fluxo de uma chamada:
  1. O consultório faz POST /chamar.
  2. O número da chamada (1ª, 2ª, 3ª...) é reservado na hora, de forma atômica.
  3. O áudio é gerado (edge-tts, com fallback para gTTS) sem travar o servidor.
  4. A chamada é publicada como um "evento" com número sequencial (seq).
  5. Os painéis ficam em long-polling em GET /eventos e recebem o evento na hora.
  6. O registro no MySQL é feito em segundo plano, sem atrasar a chamada.

IMPORTANTE: o estado das chamadas fica em memória. Rode o uvicorn com UM worker
(não use --workers > 1), senão cada processo terá uma fila diferente e os painéis
vão perder chamadas.
"""
import asyncio
import logging
import os
import time
import uuid
from collections import deque
from contextlib import asynccontextmanager, closing
from datetime import datetime
from typing import Optional

import edge_tts
import mysql.connector
from dotenv import load_dotenv
from fastapi import FastAPI, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fpdf import FPDF
from gtts import gTTS
from mysql.connector import Error

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("painel")


def _env_float(nome: str, padrao: float) -> float:
    try:
        return float(os.getenv(nome, padrao))
    except ValueError:
        return padrao


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(AUDIO_DIR, exist_ok=True)

# Janela em que chamadas repetidas do mesmo paciente/consultório contam como 2ª, 3ª...
JANELA_CHAMADAS = _env_float("JANELA_CHAMADAS", 180)
# Cliques repetidos dentro desta janela são tratados como o MESMO chamado (clique duplo,
# reenvio por lentidão de rede, recepcionista impaciente).
JANELA_DUPLICADA = _env_float("JANELA_DUPLICADA", 10)
MAX_CHAMADAS = 3
# Quanto tempo os MP3 ficam no disco antes de serem apagados.
TEMPO_VIDA_AUDIO = _env_float("TEMPO_VIDA_AUDIO", 600)
# Tempo máximo que um painel fica esperando por eventos em GET /eventos.
ESPERA_MAX_EVENTOS = 25

VOZ_EDGE = "pt-BR-FranciscaNeural"
EDGE_TIMEOUT = _env_float("EDGE_TIMEOUT", 6)
GTTS_TIMEOUT = _env_float("GTTS_TIMEOUT", 8)
# Depois de uma falha do edge-tts, usa só gTTS durante este tempo antes de tentar de novo.
EDGE_PAUSA_APOS_FALHA = 60
# Quantos áudios podem ser gerados ao mesmo tempo.
TTS_CONCORRENCIA = 8

CONSULTORIOS_FEMININOS = {
    "triagem",
    "sala de medicação",
    "tomografia, sala 08",
    "densiometria, sala 09",
}


# ---------------------------------------------------------------------------
# MySQL
# ---------------------------------------------------------------------------

def conectar_mysql():
    """Abre uma conexão nova. Retorna None se não conseguir (nunca trava por muito tempo)."""
    try:
        conexao = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            port=int(os.getenv("DB_PORT") or 3306),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            connection_timeout=5,
        )
        if conexao.is_connected():
            return conexao
    except Error as e:
        logger.error("Erro ao conectar no MySQL: %s", e)
    return None


def inserir_paciente(nome_paciente, setor, consultorio, numero_chamada) -> bool:
    conexao = conectar_mysql()
    if conexao is None:
        return False
    try:
        with closing(conexao), closing(conexao.cursor()) as cursor:
            agora = datetime.now()
            cursor.execute(
                """
                INSERT INTO pacientes_atendidos (nome_paciente, setor, consultorio, data_registro, hora_registro)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (nome_paciente, setor, consultorio, agora.date(), agora.time()),
            )
            conexao.commit()
        return True
    except Error as e:
        logger.error("Erro ao inserir paciente atendido: %s", e)
        return False


def inserir_paciente_nao_atendido(nome_paciente, setor, consultorio, numero_chamada) -> bool:
    conexao = conectar_mysql()
    if conexao is None:
        return False
    try:
        with closing(conexao), closing(conexao.cursor()) as cursor:
            agora = datetime.now()
            cursor.execute(
                """
                INSERT INTO pacientes_nao_atendidos (nome_paciente, setor, consultorio, numero_chamada, data_registro, hora_registro)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (nome_paciente, setor, consultorio, numero_chamada, agora.date(), agora.time()),
            )
            conexao.commit()
        return True
    except Error as e:
        logger.error("Erro ao inserir paciente não atendido: %s", e)
        return False


# Os registros no banco vão para uma fila processada em segundo plano, em uma
# thread separada. Assim um MySQL lento ou fora do ar nunca atrasa nem trava as chamadas.
fila_banco: asyncio.Queue = asyncio.Queue(maxsize=1000)


def enfileirar_banco(funcao, *args):
    try:
        fila_banco.put_nowait((funcao, args))
    except asyncio.QueueFull:
        logger.error("Fila do banco cheia; registro descartado: %s %s", funcao.__name__, args)


async def processar_fila_banco():
    while True:
        funcao, args = await fila_banco.get()
        try:
            for tentativa in range(1, 4):
                if await asyncio.to_thread(funcao, *args):
                    break
                logger.warning("Falha ao gravar no banco (tentativa %d/3): %s", tentativa, args)
                await asyncio.sleep(5 * tentativa)
            else:
                logger.error("Registro NÃO gravado no banco após 3 tentativas: %s %s", funcao.__name__, args)
        except Exception:
            logger.exception("Erro inesperado ao gravar no banco")
        finally:
            fila_banco.task_done()


# ---------------------------------------------------------------------------
# Geração de áudio (TTS)
# ---------------------------------------------------------------------------

_tts_semaforo = asyncio.Semaphore(TTS_CONCORRENCIA)
_edge_pausado_ate = 0.0


def _arquivo_ok(path: str) -> bool:
    return os.path.isfile(path) and os.path.getsize(path) > 0


def _remover(path: str):
    try:
        os.remove(path)
    except OSError:
        pass


def _gerar_gtts(texto: str, destino: str):
    gTTS(texto, lang="pt").save(destino)


async def gerar_audio(texto: str) -> Optional[str]:
    """Gera o MP3 e devolve o nome do arquivo, ou None se nenhum motor de voz funcionar.

    O arquivo é gravado em um temporário e só depois renomeado, então o painel
    nunca baixa um MP3 pela metade.
    """
    global _edge_pausado_ate
    nome = f"{uuid.uuid4().hex}.mp3"
    destino = os.path.join(AUDIO_DIR, nome)

    async with _tts_semaforo:
        # 1) edge-tts (voz melhor), com tempo limite
        if time.monotonic() >= _edge_pausado_ate:
            temp = destino + ".edge.part"
            try:
                comunicador = edge_tts.Communicate(text=texto, voice=VOZ_EDGE, rate="-12%")
                await asyncio.wait_for(comunicador.save(temp), EDGE_TIMEOUT)
                if not _arquivo_ok(temp):
                    raise RuntimeError("arquivo vazio")
                os.replace(temp, destino)
                return nome
            except Exception as e:
                _edge_pausado_ate = time.monotonic() + EDGE_PAUSA_APOS_FALHA
                logger.warning(
                    "[EDGE-TTS] Falhou (%s: %s). Usando gTTS pelos próximos %ds.",
                    type(e).__name__, e, EDGE_PAUSA_APOS_FALHA,
                )
                _remover(temp)

        # 2) gTTS em thread separada (é bloqueante), com tempo limite
        temp = destino + ".gtts.part"
        try:
            await asyncio.wait_for(asyncio.to_thread(_gerar_gtts, texto, temp), GTTS_TIMEOUT)
            if not _arquivo_ok(temp):
                raise RuntimeError("arquivo vazio")
            os.replace(temp, destino)
            return nome
        except Exception as e:
            logger.error("[gTTS] Falhou (%s: %s). Chamada seguirá sem voz.", type(e).__name__, e)
            _remover(temp)

    return None


def montar_texto(nome_paciente: str, consultorio: str, numero_chamada: int) -> str:
    artigo = "à" if consultorio.lower() in CONSULTORIOS_FEMININOS else "ao"
    texto = f"{nome_paciente}, dirigir-se {artigo} {consultorio}"
    if numero_chamada > 1:
        texto += f" (chamada número {numero_chamada})"
    return texto


# ---------------------------------------------------------------------------
# Estado das chamadas (em memória)
# ---------------------------------------------------------------------------

# Muda a cada reinício do servidor; o painel usa para saber que a sequência recomeçou.
BOOT_ID = uuid.uuid4().hex[:12]
_seq = 0
# Todas as chamadas publicadas, em ordem. Os painéis leem daqui.
eventos: deque = deque(maxlen=2000)
# Última chamada de cada (setor, consultório, paciente) — usada para contar 1ª/2ª/3ª.
ultima_por_chave: dict = {}
# Chamadas que ainda estão gerando áudio, para não duplicar em cliques repetidos.
em_andamento: dict = {}
# Acordado sempre que uma chamada nova é publicada.
_novo_evento = asyncio.Event()


def publicar(chamada: dict):
    global _seq, _novo_evento
    _seq += 1
    chamada["seq"] = _seq
    eventos.append(chamada)
    aviso, _novo_evento = _novo_evento, asyncio.Event()
    aviso.set()


def com_idade(chamada: dict, agora: float) -> dict:
    return {**chamada, "idade": round(agora - chamada["timestamp"], 1)}


async def limpeza_periodica():
    while True:
        await asyncio.sleep(60)
        try:
            agora = time.time()
            for nome in os.listdir(AUDIO_DIR):
                if not (nome.endswith(".mp3") or nome.endswith(".part")):
                    continue
                caminho = os.path.join(AUDIO_DIR, nome)
                try:
                    if agora - os.path.getmtime(caminho) > TEMPO_VIDA_AUDIO:
                        os.remove(caminho)
                except OSError:
                    pass

            expiradas = [
                chave for chave, item in ultima_por_chave.items()
                if agora - item["chamada"]["timestamp"] > JANELA_CHAMADAS * 2
            ]
            for chave in expiradas:
                del ultima_por_chave[chave]
        except Exception:
            logger.exception("Erro na limpeza periódica")


@asynccontextmanager
async def lifespan(app: FastAPI):
    tarefas = [
        asyncio.create_task(limpeza_periodica()),
        asyncio.create_task(processar_fila_banco()),
    ]
    logger.info("Painel iniciado (boot=%s). Lembre: rode com UM worker só.", BOOT_ID)
    yield
    for tarefa in tarefas:
        tarefa.cancel()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "API do painel de senhas rodando!"}


@app.get("/status")
async def status():
    """Diagnóstico rápido: abra no navegador para ver se está tudo saudável."""
    return {
        "boot": BOOT_ID,
        "seq": _seq,
        "chamadas_em_memoria": len(eventos),
        "gerando_audio_agora": len(em_andamento),
        "fila_banco": fila_banco.qsize(),
        "edge_tts_ativo": time.monotonic() >= _edge_pausado_ate,
        "hora_servidor": datetime.now().isoformat(timespec="seconds"),
    }


# ---------------------------------------------------------------------------
# Chamadas
# ---------------------------------------------------------------------------

async def _executar_chamada(chave, nome, consultorio, setor, numero, agora) -> dict:
    nao_atendido = numero > MAX_CHAMADAS
    audio_url = None
    if not nao_atendido:
        arquivo = await gerar_audio(montar_texto(nome, consultorio, numero))
        if arquivo:
            audio_url = f"/static/{arquivo}"

    chamada = {
        "id": str(uuid.uuid4()),
        "paciente": nome,
        "consultorio": consultorio,
        "audio_url": audio_url,
        "timestamp": agora,
        "setor": setor,
        "numero_chamada": numero,
        "nao_atendido": nao_atendido,
    }
    publicar(chamada)

    if nao_atendido:
        resposta = {"error": "Paciente já foi chamado 3 vezes. Chame outro paciente", "paciente": chamada}
    else:
        resposta = chamada
    ultima_por_chave[chave] = {"chamada": chamada, "resposta": resposta}

    consultorio_normalizado = consultorio.lower()
    if numero == 1:
        enfileirar_banco(inserir_paciente, nome, setor, consultorio_normalizado, numero)
    elif numero == MAX_CHAMADAS + 1:
        enfileirar_banco(inserir_paciente_nao_atendido, nome, setor, consultorio_normalizado, numero)

    logger.info(
        "Chamada #%d publicada: %s -> %s [%s] (%dª chamada%s)",
        chamada["seq"], nome, consultorio, setor, numero,
        ", NÃO ATENDIDO" if nao_atendido else "" if audio_url else ", SEM ÁUDIO",
    )
    return resposta


@app.post("/chamar")
async def chamar_paciente(
    nome_paciente: str = Form(...),
    consultorio: str = Form(...),
    setor: str = Form(...),
):
    nome = " ".join(nome_paciente.split()).upper()
    consultorio = " ".join(consultorio.split())
    setor = setor.strip().lower()
    if not nome or not consultorio or not setor:
        raise HTTPException(status_code=400, detail="Preencha o nome do paciente e o setor.")

    chave = (setor, consultorio.lower(), nome)
    agora = time.time()

    # Mesmo paciente ainda sendo processado (clique duplo / reenvio): devolve o mesmo resultado.
    tarefa = em_andamento.get(chave)
    if tarefa is not None:
        logger.info("Clique repetido ignorado (em andamento): %s", chave)
        return await asyncio.shield(tarefa)

    # Mesmo paciente chamado há poucos segundos: não conta como nova chamada.
    anterior = ultima_por_chave.get(chave)
    if anterior and agora - anterior["chamada"]["timestamp"] < JANELA_DUPLICADA:
        logger.info("Clique repetido ignorado (%.1fs após o anterior): %s",
                    agora - anterior["chamada"]["timestamp"], chave)
        return anterior["resposta"]

    if anterior and agora - anterior["chamada"]["timestamp"] < JANELA_CHAMADAS:
        numero = anterior["chamada"]["numero_chamada"] + 1
    else:
        numero = 1

    # Roda em uma task própria: se o navegador desconectar no meio, a chamada é concluída mesmo assim.
    tarefa = asyncio.create_task(_executar_chamada(chave, nome, consultorio, setor, numero, agora))
    em_andamento[chave] = tarefa
    tarefa.add_done_callback(
        lambda t: em_andamento.pop(chave) if em_andamento.get(chave) is t else None
    )
    return await asyncio.shield(tarefa)


@app.get("/eventos")
async def eventos_do_setor(
    setor: str = Query(...),
    desde: int = Query(0, ge=0),
    boot: Optional[str] = Query(None),
    espera: float = Query(0, ge=0, le=ESPERA_MAX_EVENTOS),
):
    """Long-polling para os painéis.

    Devolve as chamadas do setor com seq > desde. Se não houver nenhuma, segura a
    requisição por até `espera` segundos e responde assim que uma chamada nova chegar.
    O tempo é sempre calculado no servidor ("idade"), então o relógio da TV não importa.
    """
    setor = setor.strip().lower()
    if boot != BOOT_ID:
        # Primeira conexão do painel ou servidor reiniciado: manda tudo que for recente.
        desde, espera = 0, 0

    limite = time.monotonic() + espera
    while True:
        aviso = _novo_evento  # pegar ANTES de verificar, para não perder evento
        novas = [c for c in eventos if c["seq"] > desde and c["setor"] == setor]
        restante = limite - time.monotonic()
        if novas or restante <= 0:
            break
        try:
            await asyncio.wait_for(aviso.wait(), restante)
        except asyncio.TimeoutError:
            pass

    agora = time.time()
    return {
        "boot": BOOT_ID,
        "seq": _seq,
        "chamadas": [com_idade(c, agora) for c in novas if agora - c["timestamp"] < JANELA_CHAMADAS],
    }


@app.get("/ultimas-chamadas")
async def ultimas_chamadas(setor: str = Query(...)):
    """Mantido por compatibilidade: chamadas do setor nos últimos 3 minutos, em ordem."""
    setor = setor.strip().lower()
    agora = time.time()
    return [
        com_idade(c, agora)
        for c in eventos
        if c["setor"] == setor and agora - c["timestamp"] < JANELA_CHAMADAS
    ]


@app.get("/static/{filename}")
async def servir_audio(filename: str):
    nome = os.path.basename(filename)
    path = os.path.join(AUDIO_DIR, nome)
    if nome == filename and not nome.endswith(".part") and _arquivo_ok(path):
        if nome.endswith(".mp3"):
            # Cada áudio tem nome único, então pode ser cacheado sem risco.
            return FileResponse(path, media_type="audio/mpeg",
                                headers={"Cache-Control": "public, max-age=600"})
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="Arquivo não encontrado ou inválido")


# ---------------------------------------------------------------------------
# Relatórios em PDF
# ---------------------------------------------------------------------------

MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
         "agosto", "setembro", "outubro", "novembro", "dezembro"]


def _data_por_extenso(data) -> str:
    return f"{data.day:02d} de {MESES[data.month - 1]} de {data.year}"


def _latin1(texto) -> str:
    # A fonte Arial do FPDF só aceita latin-1; troca caracteres fora disso por "?"
    return str(texto).encode("latin-1", "replace").decode("latin-1")


def _validar_data(data: str):
    try:
        return datetime.strptime(data, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida. Use o formato AAAA-MM-DD.")


def _consultar(sql: str, params: tuple) -> list:
    conexao = conectar_mysql()
    if conexao is None:
        raise HTTPException(status_code=503, detail="Banco de dados indisponível no momento.")
    try:
        with closing(conexao), closing(conexao.cursor()) as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()
    except Error as e:
        logger.error("Erro ao consultar relatório: %s", e)
        raise HTTPException(status_code=503, detail="Erro ao consultar o banco de dados.")


def _pdf_resposta(pdf: FPDF, filename: str) -> Response:
    saida = pdf.output(dest="S")
    conteudo = saida.encode("latin-1") if isinstance(saida, str) else bytes(saida)
    return Response(
        content=conteudo,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class PDFRelatorio(FPDF):
    def __init__(self, titulo: str = "Relatório de Pacientes"):
        super().__init__()
        self.titulo = titulo

    def header(self):
        if self.page_no() == 1:
            # Exibir logo e título somente na primeira página
            logo_path = os.path.join(BASE_DIR, "static", "logo-santa-casa.jpg")
            if os.path.exists(logo_path):
                self.image(logo_path, x=80, y=10, w=40)

            self.ln(50)
            self.set_font("Arial", "B", 18)
            self.cell(0, 10, _latin1(f"Santa Casa de Misericórdia de Guaíra - {self.titulo} "),
                      border=False, ln=True, align="C")
            self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Arial", "I", 8)
        self.cell(0, 10, _latin1("Santa Casa de Guaíra - Sistema de Chamadas © 2026"), 0, 0, "C")


@app.get("/relatorio-atendidos")
def gerar_relatorio_atendidos(data: str = Query(...)):
    data_date = _validar_data(data)
    resultados = _consultar(
        """
        SELECT nome_paciente, setor, consultorio, hora_registro
        FROM pacientes_atendidos
        WHERE data_registro = %s
        ORDER BY hora_registro
        """,
        (data_date,),
    )
    if not resultados:
        raise HTTPException(status_code=404, detail="Nenhum paciente atendido nesta data.")

    pdf = PDFRelatorio("Relatório de chamados")
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.ln(5)
    pdf.cell(0, 10, _latin1(f"Data do relatório de pacientes que foram chamados: {_data_por_extenso(data_date)}"),
             ln=True, align="R")
    pdf.ln(5)

    for nome, setor, consultorio, hora in resultados:
        pdf.multi_cell(0, 10, _latin1(f"{str(hora)[:-3]} - {nome} | Setor: {setor} | CC: {consultorio}"))

    return _pdf_resposta(pdf, f"relatorio_atendidos_{data}.pdf")


@app.get("/relatorio-nao-atendidos")
def gerar_relatorio(data: str = Query(..., description="Formato: YYYY-MM-DD")):
    data_date = _validar_data(data)
    resultados = _consultar(
        """
        SELECT nome_paciente, setor, consultorio, numero_chamada, hora_registro
        FROM pacientes_nao_atendidos
        WHERE data_registro = %s
        ORDER BY hora_registro
        """,
        (data_date,),
    )
    if not resultados:
        raise HTTPException(status_code=404, detail="Nenhum paciente encontrado para esta data.")

    pdf = PDFRelatorio("Relatório de Não Atendidos")
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_font("Arial", size=12)
    pdf.ln(5)
    pdf.cell(0, 10, _latin1(f"Data do relatório de pacientes que não responderam ao chamado: {_data_por_extenso(data_date)}"),
             ln=True, align="R")
    pdf.ln(5)

    for nome, setor, consultorio, numero, hora in resultados:
        pdf.multi_cell(0, 10, _latin1(f"{str(hora)[:-3]} - {nome} | Setor: {setor} | CC: {consultorio} | Chamada: {numero}"))

    return _pdf_resposta(pdf, f"relatorio_{data}.pdf")


if __name__ == "__main__":
    print("Conexão OK" if conectar_mysql() else "Falha na conexão")
