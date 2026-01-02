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
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv
from datetime import datetime
from fpdf import FPDF
import locale
from collections import deque
import edge_tts
from edge_tts import Communicate

app = FastAPI()
load_dotenv()



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # endereço do frontend que pode acessar
    allow_credentials=True,
    allow_methods=["*"],   # permite todos os métodos (GET, POST, etc)
    allow_headers=["*"],   # permite todos os headers
)

def conectar_mysql():
    try:
        conexao = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            port=int(os.getenv('DB_PORT')),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME')
        )

        if conexao.is_connected():
            print("Conexão com MySQL estabelecida!")
            return conexao
    except Error as e:
        print("Erro ao conectar:", e)

    return None
if __name__ == "__main__":
    conectar_mysql()

def inserir_paciente(nome_paciente, setor, consultorio, numero_chamada):
    conexao = conectar_mysql()
    if conexao is None:
        print("Erro na conexão, não foi possível inserir paciente.")
        return False
    try:
        
        cursor = conexao.cursor()
        agora = datetime.now()
        sql = """
            INSERT INTO pacientes_atendidos (nome_paciente, setor, consultorio, data_registro, hora_registro)
            VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(sql, (nome_paciente, setor, consultorio, agora.date(), agora.time()))
        conexao.commit()
        cursor.close()
        conexao.close()
    except Exception as e:
        print("Erro ao inserir paciente atendido:", e)
        return False
    
            
def inserir_paciente_nao_atendido(nome_paciente, setor, consultorio, numero_chamada):
        conexao = conectar_mysql()
        if conexao is None:
            print("Erro na conexão, não foi possível inserir paciente não atendido.")
            return False
        try:
            cursor = conexao.cursor()
            agora = datetime.now()
            data = agora.date()
            hora = agora.time()
            sql = """
                INSERT INTO pacientes_nao_atendidos (nome_paciente, setor, consultorio, numero_chamada, data_registro, hora_registro)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            valores = (nome_paciente, setor,consultorio, numero_chamada,  data, hora)
            cursor.execute(sql, valores)
            conexao.commit()
            cursor.close()
            conexao.close()
            print("Paciente não atendido inserido com sucesso.")
            return True
        except Error as e:
            print("Erro ao inserir paciente não atendido:", e)
            return False

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

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(testar_edge_tts())

@app.get("/")
async def root():
    return {"message": "API do painel de senhas rodando!"}

fila_audios = deque()
reproduzindo_audio = False

async def processar_fila_audios():
    global reproduzindo_audio
    if reproduzindo_audio:
        return  # Já está processando

    reproduzindo_audio = True
    while fila_audios:
        chamada = fila_audios.popleft()

        # Aqui podemos apenas "esperar" um tempo proporcional ao áudio
        # ou enviar para o painel tocar na ordem
        print(f"[FILA] Reproduzindo chamada: {chamada['paciente']} - {chamada['audio_url']}")

        # Aguarda o tempo de reprodução (exemplo: 3s por chamada)
        await asyncio.sleep(3)

    reproduzindo_audio = False
    
EDGE_TTS_OK = True  # Flag global indicando se edge-tts está disponível

async def gerar_audio(texto: str, filepath: str):
    global EDGE_TTS_OK

    # 1) Tenta EDGE TTS primeiro
    if EDGE_TTS_OK:
        try:
            communicate = edge_tts.Communicate(
                text=texto,
                voice="pt-BR-FranciscaNeural",
                rate="-12%"
            )
            await communicate.save(filepath)

            if not os.path.exists(filepath) or os.path.getsize(filepath) == 0:
                raise RuntimeError(f"[EDGE-TTS] Arquivo vazio ou inexistente: {filepath}")

            print(f"[EDGE-TTS] Áudio gerado com sucesso: {filepath}")
            return

        except Exception as e:
            print(f"[EDGE-TTS] Falha detectada: {e}. Fallback para gTTS.")
            EDGE_TTS_OK = False  # marca edge-tts como indisponível

    # 2) Fallback gTTS
    try:
        tts = gTTS(texto, lang="pt")
        tts.save(filepath)

        if not os.path.exists(filepath) or os.path.getsize(filepath) == 0:
            raise RuntimeError(f"[gTTS] Arquivo vazio ou inexistente: {filepath}")

        print(f"[gTTS] Áudio gerado com sucesso: {filepath}")
        return

    except Exception as e:
        raise RuntimeError(f"[gTTS] Falha ao gerar áudio: {e}")
    
async def testar_edge_tts():
    global EDGE_TTS_OK
    while True:
        if not EDGE_TTS_OK:
            teste_path = os.path.join(AUDIO_DIR, "teste_edge.mp3")
            try:
                communicate = edge_tts.Communicate(
                    text="Teste",
                    voice="pt-BR-FranciscaNeural"
                )
                await communicate.save(teste_path)
                # Verifica arquivo criado
                if os.path.exists(teste_path) and os.path.getsize(teste_path) > 0:
                    EDGE_TTS_OK = True
                    print("[EDGE-TTS] Voltou! Agora é o primário novamente.")
                    os.remove(teste_path)
            except:
                pass
        await asyncio.sleep(60)
  
@app.post("/chamar")
async def chamar_paciente(
    nome_paciente: str = Form(...),
    consultorio: str = Form(...),
    setor: str = Form(...)
):
    global chamadas_recentes, historico_chamadas
    agora = time.time()
    consultorio_normalizado = consultorio.strip().lower()

    historico_chamadas[:] = [
        c for c in historico_chamadas if agora - c["timestamp"] < 180
    ]

    chamadas_anteriores = [
    c for c in historico_chamadas
    if c["paciente"] == nome_paciente
    and c["consultorio"].strip().lower() == consultorio_normalizado
    and c["setor"] == setor  
]
    chamada_num = len(chamadas_anteriores) + 1
    nao_respondido = chamada_num > 3

    if chamada_num == 1:
        inserir_paciente(nome_paciente, setor, consultorio_normalizado, chamada_num)
    elif nao_respondido:
        inserir_paciente_nao_atendido(nome_paciente, setor, consultorio_normalizado, chamada_num)

    if not nao_respondido:
        texto = (
            f"{nome_paciente}, dirigir-se {'à' if consultorio_normalizado in ['triagem', 'sala de medicação'] else 'ao'} {consultorio} (chamada número {chamada_num})"
            if chamada_num > 1 else
            f"{nome_paciente}, dirigir-se {'à' if consultorio_normalizado in ['triagem', 'sala de medicação'] else 'ao'} {consultorio}"
        )
        filename = f"{uuid.uuid4()}.mp3"
        filepath = os.path.join(AUDIO_DIR, filename)

        await gerar_audio(texto, filepath)

        asyncio.create_task(apagar_audio_apos_3_minutos(filepath))
        audio_url = f"/static/{filename}"
    else:
        audio_url = "/static/audio_silencioso.mp3"

    chamada = {
        "id": str(uuid.uuid4()),
        "paciente": nome_paciente,
        "consultorio": consultorio,
        "audio_url": audio_url,
        "timestamp": agora,
        "setor": setor,
        "numero_chamada": chamada_num,
        "nao_atendido": nao_respondido
    }

    chamadas_recentes[:] = [
        c for c in chamadas_recentes if agora - c["timestamp"] < 180 and c["consultorio"].strip().lower() != consultorio_normalizado
    ]
    if chamada_num <= 3:
        chamadas_recentes.append(chamada)
    historico_chamadas.append(chamada)

    if nao_respondido:
        return {"error": "Paciente já foi chamado 3 vezes. Chame outro paciente", "paciente": chamada}
    return chamada


@app.get("/ultimas-chamadas")
async def ultimas_chamadas(setor: str = Query(...)):
    agora = time.time()
    validas = []

    # Agrupa chamadas por paciente usando o HISTÓRICO, não apenas o painel
    chamadas_por_paciente = {}
    for c in historico_chamadas:
        if c["setor"] == setor:
            paciente = c["paciente"]
            chamadas_por_paciente.setdefault(paciente, []).append(c)

    for paciente, chamadas in chamadas_por_paciente.items():
        ultima = chamadas[-1]  # pega a última chamada válida
        chamada = dict(ultima)

        # Conta todas as chamadas no histórico para este paciente/ setor
        total_chamadas = len(chamadas)

        # Marca não atendido se já passou da 3ª chamada
        chamada["nao_atendido"] = total_chamadas > 3
        validas.append(chamada)

    return validas



from fastapi import HTTPException
try:
    locale.setlocale(locale.LC_TIME, 'pt_BR.UTF-8')  # Linux/macOS
except locale.Error:
    try:
        locale.setlocale(locale.LC_TIME, 'Portuguese_Brazil.1252')  # Windows
    except locale.Error:
        print("Aviso: Locale pt_BR não suportado neste sistema.")

class PDFRelatorio(FPDF):
    def __init__(self, titulo: str = "Relatório de Pacientes"):
        super().__init__()
        self.titulo = titulo

    def header(self):
        if self.page_no() == 1:
            # Exibir logo e título somente na primeira página
            logo_path = os.path.join(os.path.dirname(__file__), "static", "logo-santa-casa.jpg")
            self.image(logo_path, x=80, y=10, w=40)  # Reduzi o tamanho também

            self.ln(50)
            self.set_font("Arial", "B", 18)
            self.cell(0, 10, f"Santa Casa de Misericórdia de Guaíra - {self.titulo} ", border=False, ln=True, align="C")
            self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Arial", "I", 8)
        self.cell(0, 10, "Santa Casa de Guaíra - Sistema de Chamadas © 2025", 0, 0, "C")

@app.get("/relatorio-atendidos")
def gerar_relatorio_atendidos(data: str = Query(...)):
    conn = conectar_mysql()
    cursor = conn.cursor()
    data_date = datetime.strptime(data, "%Y-%m-%d").date()
    cursor.execute("""
        SELECT nome_paciente, setor, consultorio, hora_registro
        FROM pacientes_atendidos
        WHERE data_registro = %s
        ORDER BY hora_registro
    """, (data_date,))
    resultados = cursor.fetchall()

    if not resultados:
        raise HTTPException(status_code=404, detail="Nenhum paciente atendido nesta data.")

    data_formatada = datetime.strptime(data, "%Y-%m-%d").strftime("%d de %B de %Y")

    pdf = PDFRelatorio("Relatório de chamados")
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.ln(5)
    pdf.cell(0, 10, f"Data do relatório de pacientes que foram chamados: {data_formatada}", ln=True, align="R")
    pdf.ln(5)

    for row in resultados:
        nome, setor, consultorio, hora = row
        linha = f"{str(hora)[:-3]} - {nome} | Setor: {setor} | CC: {consultorio}"
        pdf.multi_cell(0, 10, linha)

    filename = f"relatorio_atendidos_{data}.pdf"
    caminho = os.path.join("relatorios", filename)
    os.makedirs("relatorios", exist_ok=True)
    pdf.output(caminho)

    return FileResponse(caminho, filename=filename, media_type="application/pdf")

@app.get("/relatorio-nao-atendidos")
def gerar_relatorio(data: str = Query(..., description="Formato: YYYY-MM-DD")):
    conn = conectar_mysql()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT nome_paciente, setor, consultorio, numero_chamada, hora_registro 
        FROM pacientes_nao_atendidos
        WHERE data_registro = %s
        ORDER BY hora_registro
    """, (data,))
    resultados = cursor.fetchall()

    if not resultados:
        raise HTTPException(status_code=404, detail="Nenhum paciente encontrado para esta data.")

    # Formata a data para exibição no relatório
    data_formatada = datetime.strptime(data, "%Y-%m-%d").strftime("%d de %B de %Y")

    # Criar PDF
    pdf = PDFRelatorio("Relatório de Não Atendidos")
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_font("Arial", size=12)
    pdf.ln(5)
    pdf.cell(0, 10, f"Data do relatório de pacientes que não responderam ao chamado: {data_formatada}", ln=True, align="R")
    pdf.ln(5)

    for row in resultados:
        nome, setor, consultorio, numero, hora = row
        linha = f"{str(hora)[:-3]} - {nome} | Setor: {setor} | CC: {consultorio} | Chamada: {numero}"
        pdf.multi_cell(0, 10, linha)

    # Salvar PDF temporário
    filename = f"relatorio_{data}.pdf"
    caminho = os.path.join("relatorios", filename)
    os.makedirs("relatorios", exist_ok=True)
    pdf.output(caminho)

    return FileResponse(caminho, filename=filename, media_type='application/pdf')

@app.get("/static/{filename}")
async def servir_audio(filename: str):
    path = os.path.join(AUDIO_DIR, filename)
    if os.path.isfile(path) and os.path.getsize(path) > 0:
        return FileResponse(path, media_type="audio/mpeg")
    raise HTTPException(status_code=404, detail="Arquivo não encontrado ou inválido")
