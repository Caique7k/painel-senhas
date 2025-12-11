"use client";
import { useState, useEffect, useRef } from "react";

type Senha = {
  id: string;
  paciente: string;
  consultorio: string;
  audio_url: string;
  timestamp: number;
  numero_chamada?: number;
  nao_atendido?: boolean;
};

const Snowfall = () => {
  const flakes = Array.from({ length: 25 }); // quantidade de flocos

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {flakes.map((_, i) => (
          <span key={i} className="snowflake">
            ❄
          </span>
        ))}
      </div>

      <style jsx global>{`
        .snowflake {
          position: absolute;
          top: -10%;
          font-size: 18px;
          color: rgba(255, 255, 255, 0.45);
          text-shadow: 0 0 4px rgba(0, 0, 0, 0.25);
          animation-name: snowfall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes snowfall {
          0% {
            transform: translate3d(0, 0, 0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 110vh, 0);
            opacity: 0;
          }
        }

        /* ... seus nth-child dos flocos aqui, mantive igual ... */
        .snowflake:nth-child(1) {
          left: 5%;
          animation-duration: 14s;
          animation-delay: -2s;
        }
        .snowflake:nth-child(2) {
          left: 12%;
          animation-duration: 18s;
          animation-delay: -5s;
        }
        .snowflake:nth-child(3) {
          left: 20%;
          animation-duration: 16s;
          animation-delay: -8s;
        }
        .snowflake:nth-child(4) {
          left: 28%;
          animation-duration: 20s;
          animation-delay: -3s;
        }
        .snowflake:nth-child(5) {
          left: 35%;
          animation-duration: 17s;
          animation-delay: -10s;
        }
        .snowflake:nth-child(6) {
          left: 42%;
          animation-duration: 19s;
          animation-delay: -6s;
        }
        .snowflake:nth-child(7) {
          left: 50%;
          animation-duration: 22s;
          animation-delay: -12s;
        }
        .snowflake:nth-child(8) {
          left: 58%;
          animation-duration: 15s;
          animation-delay: -4s;
        }
        .snowflake:nth-child(9) {
          left: 65%;
          animation-duration: 19s;
          animation-delay: -9s;
        }
        .snowflake:nth-child(10) {
          left: 72%;
          animation-duration: 21s;
          animation-delay: -1s;
        }
        .snowflake:nth-child(11) {
          left: 79%;
          animation-duration: 18s;
          animation-delay: -7s;
        }
        .snowflake:nth-child(12) {
          left: 86%;
          animation-duration: 23s;
          animation-delay: -11s;
        }
        .snowflake:nth-child(13) {
          left: 93%;
          animation-duration: 17s;
          animation-delay: -13s;
        }
        .snowflake:nth-child(14) {
          left: 2%;
          animation-duration: 20s;
          animation-delay: -15s;
        }
        .snowflake:nth-child(15) {
          left: 18%;
          animation-duration: 24s;
          animation-delay: -6s;
        }
        .snowflake:nth-child(16) {
          left: 31%;
          animation-duration: 19s;
          animation-delay: -14s;
        }
        .snowflake:nth-child(17) {
          left: 44%;
          animation-duration: 22s;
          animation-delay: -9s;
        }
        .snowflake:nth-child(18) {
          left: 57%;
          animation-duration: 16s;
          animation-delay: -3s;
        }
        .snowflake:nth-child(19) {
          left: 70%;
          animation-duration: 21s;
          animation-delay: -5s;
        }
        .snowflake:nth-child(20) {
          left: 83%;
          animation-duration: 25s;
          animation-delay: -16s;
        }
        .snowflake:nth-child(21) {
          left: 10%;
          animation-duration: 26s;
          animation-delay: -7s;
        }
        .snowflake:nth-child(22) {
          left: 38%;
          animation-duration: 18s;
          animation-delay: -2s;
        }
        .snowflake:nth-child(23) {
          left: 63%;
          animation-duration: 24s;
          animation-delay: -10s;
        }
        .snowflake:nth-child(24) {
          left: 88%;
          animation-duration: 20s;
          animation-delay: -4s;
        }
        .snowflake:nth-child(25) {
          left: 50%;
          animation-duration: 28s;
          animation-delay: -18s;
        }
      `}</style>
    </>
  );
};

export default function Painel() {
  const [senhas, setSenhas] = useState<Senha[]>([]);
  const [ultimasChamadas, setUltimasChamadas] = useState<Senha[]>([]);
  const [chamadaAtual, setChamadaAtual] = useState<Senha | null>(null);
  const [horaAtual, setHoraAtual] = useState(new Date());
  const [audioLiberado, setAudioLiberado] = useState(false);

  const historicoAudios = useRef<
    { paciente: string; consultorio: string; time: number }[]
  >([]);
  const filaAudios = useRef<Senha[]>([]);
  const tocando = useRef(false);

  const liberarAudio = () => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    oscillator.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.01);
    setAudioLiberado(true);
  };

  useEffect(() => {
    const handleClick = () => {
      liberarAudio();
      window.removeEventListener("click", handleClick);
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const tocarBeep = () => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 1);
  };

  // 🔊 Helper: tenta tocar o áudio várias vezes, com pequeno delay
  const tocarAudioComRetry = (
    url: string,
    tentativas: number = 5,
    delayMs: number = 800
  ): Promise<void> => {
    return new Promise((resolve) => {
      const tentar = (restantes: number) => {
        const cacheBuster = `t=${Date.now()}`;
        const sep = url.includes("?") ? "&" : "?";
        const finalUrl = `${url}${sep}${cacheBuster}`;

        const audio = new Audio(finalUrl);

        audio.onended = () => {
          resolve();
        };

        audio.onerror = () => {
          console.warn("Falha ao carregar áudio, restantes:", restantes - 1);
          if (restantes > 1) {
            setTimeout(() => tentar(restantes - 1), delayMs);
          } else {
            console.error("Erro ao carregar áudio após várias tentativas.");
            resolve(); // desiste e segue a fila
          }
        };

        audio.play().catch((err) => {
          console.error("Erro ao reproduzir áudio:", err);
          if (restantes > 1) {
            setTimeout(() => tentar(restantes - 1), delayMs);
          } else {
            resolve();
          }
        });
      };

      tentar(tentativas);
    });
  };

  const processarFila = () => {
    if (tocando.current || filaAudios.current.length === 0) return;
    tocando.current = true;

    const chamada = filaAudios.current.shift();
    if (!chamada) {
      tocando.current = false;
      return;
    }

    setChamadaAtual(chamada);

    if (chamada.nao_atendido) {
      // Chamada não atendida: não toca áudio, só exibe no painel
      tocando.current = false;
      processarFila();
      return;
    }

    tocarBeep();

    setTimeout(() => {
      const url = `${process.env.NEXT_PUBLIC_API_URL}${chamada.audio_url}`;

      tocarAudioComRetry(url)
        .then(() => {
          // terminou (com sucesso ou desistiu), segue
        })
        .finally(() => {
          tocando.current = false;
          processarFila();
        });
    }, 1000);
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // indica que estamos no cliente
  }, []);

  const adicionarNaFila = (senha: Senha) => {
    const agora = Date.now();

    // Atualiza o histórico de áudio para evitar repetição
    historicoAudios.current = historicoAudios.current.filter(
      (h) => agora - h.time < 3000
    );
    const repetido = historicoAudios.current.some(
      (h) =>
        h.paciente === senha.paciente && h.consultorio === senha.consultorio
    );
    if (!repetido) {
      historicoAudios.current.push({
        paciente: senha.paciente,
        consultorio: senha.consultorio,
        time: agora,
      });

      // Se for chamada normal, adiciona na fila de áudio
      if (!senha.nao_atendido) {
        filaAudios.current.push(senha);
        processarFila();
      }
    }

    // Atualiza sempre a lista de últimas chamadas (com até 4)
    setUltimasChamadas((old) => {
      const atualizadas = old.filter(
        (c) =>
          c.paciente !== senha.paciente || c.consultorio !== senha.consultorio
      );
      return [senha, ...atualizadas].slice(0, 4);
    });
  };

  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const buscarChamadas = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/ultimas-chamadas?setor=pa`
        );
        const data: Senha[] = await res.json();

        setSenhas((prev) => {
          const agora = Date.now();
          const chamadasComTimestampMs = data.map((c) => ({
            ...c,
            timestamp: c.timestamp * 1000,
          }));

          const atualizadas = [...prev, ...chamadasComTimestampMs]
            .filter((c) => agora - c.timestamp < 180000)
            .reduce<Senha[]>((acc, chamada) => {
              const normalizado = chamada.consultorio.trim().toLowerCase();
              return [
                ...acc.filter(
                  (c) => c.consultorio.trim().toLowerCase() !== normalizado
                ),
                chamada,
              ];
            }, []);

          const idsAntigos = new Set(prev.map((s) => s.id));
          const novasChamadas = atualizadas.filter(
            (s) => !idsAntigos.has(s.id)
          );
          novasChamadas.forEach((s) => adicionarNaFila(s));

          return atualizadas;
        });
      } catch (error) {
        console.error("Erro ao buscar chamadas:", error);
      }
    };

    buscarChamadas();
    const interval = setInterval(buscarChamadas, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main
      className="relative min-h-screen w-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: "#24235c" }}
    >
      <Snowfall />
      {/* Header */}
      <header className="relative z-10 flex justify-between items-center px-8 py-4 border-b border-white/20">
        <div className="flex items-center gap-4">
          <img
            src="/logo-santa-casa.jpg"
            alt="Santa Casa Logo"
            className="h-20 w-auto"
          />
          <div className="flex flex-col">
            <h1 className="text-white text-4xl font-bold">
              Santa Casa de Misericórdia de Guaíra 🎄
            </h1>
            <span className="text-white/70 text-lg">Boas Festas!</span>
          </div>
        </div>
        <div className="text-right text-white text-2xl">
          {mounted ? (
            <>
              <p>
                {horaAtual.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p>{horaAtual.toLocaleDateString("pt-BR")}</p>
            </>
          ) : (
            <p className="opacity-50">--:--</p>
          )}
        </div>
      </header>

      {/* Paciente Atual */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
        {chamadaAtual ? (
          <>
            <h2 className="text-white text-7xl font-extrabold text-center">
              {chamadaAtual.paciente}
            </h2>
            {chamadaAtual.numero_chamada && chamadaAtual.numero_chamada > 1 && (
              <p className="text-red-500 text-3xl font-bold animate-pulse mt-2">
                CHAMADA Nº {chamadaAtual.numero_chamada}
              </p>
            )}
            <p className="text-white text-5xl mt-6">
              {chamadaAtual.consultorio}
            </p>
          </>
        ) : ultimasChamadas[0] ? (
          <>
            <h2 className="text-white text-7xl font-extrabold text-center">
              {ultimasChamadas[0].paciente}
            </h2>
            {ultimasChamadas[0].numero_chamada &&
              ultimasChamadas[0].numero_chamada > 1 && (
                <p className="text-red-500 text-3xl font-bold animate-pulse mt-2">
                  CHAMADA Nº {ultimasChamadas[0].numero_chamada}
                </p>
              )}
            <p className="text-white text-5xl mt-6">
              {ultimasChamadas[0].consultorio}
            </p>
          </>
        ) : (
          <p className="text-white/70 text-5xl">Nenhum paciente chamado</p>
        )}
      </div>

      {/* Últimas Chamadas */}
      <div className="relative z-10 bg-white/10 p-4">
        <h3 className="text-white text-2xl font-semibold mb-2">
          Últimas Chamadas
        </h3>
        <ul className="space-y-2">
          {ultimasChamadas.map((c) => (
            <li
              key={c.id}
              className="flex justify-between text-white text-2xl md:text-3xl border-b border-white/20 pb-1"
            >
              <span>
                {new Date(c.timestamp).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                - {c.paciente}
              </span>
              <span>
                {c.nao_atendido ? "Não respondeu ao chamado" : c.consultorio}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {/* Rodapé bem clean */}
      <footer className="relative z-10 text-center text-white/60 text-2xl p-4 border-t border-white/20">
        Santa Casa de Misericórdia de Guaíra deseja a todos um Natal de paz e
        saúde.
      </footer>
    </main>
  );
}
