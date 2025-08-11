"use client";
import { useState, useEffect, useRef } from "react";

type Senha = {
  id: string;
  paciente: string;
  consultorio: string;
  audio_url: string;
  timestamp: number;
  numero_chamada?: number;
};

export default function Painel() {
  const [senhas, setSenhas] = useState<Senha[]>([]);
  const [audioLiberado, setAudioLiberado] = useState(false);
  const historicoAudios = useRef<
    { paciente: string; consultorio: string; time: number }[]
  >([]);

  // Fila e controle de áudio
  const filaAudios = useRef<Senha[]>([]);
  const tocando = useRef(false);
  const idsTocados = useRef<Set<string>>(new Set()); // IDs já tocados

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

  // Beep
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

  // Processa fila de áudio (garante que toca um por vez)
  const processarFila = () => {
    if (tocando.current || filaAudios.current.length === 0) return;
    tocando.current = true;

    const chamada = filaAudios.current.shift();
    if (!chamada) {
      tocando.current = false;
      return;
    }

    tocarBeep();
    setTimeout(() => {
      const audio = new Audio(
        `${process.env.NEXT_PUBLIC_API_URL}${chamada.audio_url}`
      );
      audio.onerror = () => console.error("Erro ao carregar áudio!");
      audio.play();

      audio.onended = () => {
        setTimeout(() => {
          tocando.current = false;
          processarFila(); // chama o próximo
        }, 500); // intervalo entre áudios
      };
    }, 1000); // espera beep terminar
  };

  const adicionarNaFila = (senha: Senha) => {
    const agora = Date.now();

    // Limpa histórico antigo
    historicoAudios.current = historicoAudios.current.filter(
      (h) => agora - h.time < 3000
    );

    // Verifica se já tocou o mesmo paciente no mesmo consultório nos últimos 3s
    const repetido = historicoAudios.current.some(
      (h) =>
        h.paciente === senha.paciente && h.consultorio === senha.consultorio
    );

    if (repetido) return;

    historicoAudios.current.push({
      paciente: senha.paciente,
      consultorio: senha.consultorio,
      time: agora,
    });

    filaAudios.current.push(senha);
    processarFila();
  };

  // Buscar chamadas
  useEffect(() => {
    const buscarChamadas = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/ultimas-chamadas?setor=ps`
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
              if (normalizado === "triagem") {
                return [
                  ...acc.filter(
                    (c) => c.consultorio.trim().toLowerCase() !== "triagem"
                  ),
                  chamada,
                ];
              }
              const restante = acc.filter(
                (c) => c.consultorio.trim().toLowerCase() !== normalizado
              );
              return [...restante, chamada];
            }, []);

          // Detecta novas chamadas
          const idsAntigos = new Set(prev.map((s) => s.id));
          const novasChamadas = atualizadas.filter(
            (s) => !idsAntigos.has(s.id)
          );

          // Adiciona novas na fila de áudio sem duplicar
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
      className="min-h-screen w-screen pt-4 px-4 flex flex-col items-center justify-start overflow-y-auto"
      style={{ backgroundColor: "#24235c" }}
    >
      {/* Header */}
      <header className="flex items-center gap-8 mb-6">
        <img
          src="/logo-santa-casa.jpg"
          alt="Santa Casa Logo"
          className="h-24 w-auto rounded-md shadow-lg"
        />
        <h1 className="text-white text-6xl font-extrabold drop-shadow-lg whitespace-nowrap">
          Painel de Senhas
        </h1>
      </header>

      {/* Grid */}
      <div className="w-full flex justify-center">
        <section
          className="grid"
          style={{
            maxWidth: "1300px",
            width: "100%",
            gap: "30px 60px",
            display: "grid",
            gridTemplateColumns:
              senhas.length === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))",
            gridTemplateRows: senhas.length <= 2 ? "1fr" : "repeat(2, auto)",
            alignItems: "start",
            justifyItems: "center",
            paddingBottom: "10px",
          }}
        >
          {senhas.length === 0 ? (
            <div className="col-span-full flex items-center justify-center min-h-[600px]">
              <p className="text-white text-opacity-70 text-7xl text-center">
                Nenhuma senha chamada no momento.
              </p>
            </div>
          ) : (
            senhas.map(({ id, paciente, consultorio, numero_chamada }) => (
              <div
                key={id}
                className="fade-in bg-gradient-to-r from-indigo-700 to-purple-900 text-white px-10 py-6 rounded-3xl shadow-2xl flex flex-col justify-between items-center"
                style={{ width: "580px", height: "300px" }}
              >
                <div className="flex flex-col items-center w-full gap-2 px-4">
                  <span
                    className="text-5xl font-bold text-center leading-snug break-words"
                    style={{
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {paciente}
                  </span>

                  {numero_chamada && numero_chamada > 1 && (
                    <span
                      className="font-bold text-center"
                      style={{
                        fontSize: "1.9rem",
                        animation: "piscar 1s infinite",
                        color: "white",
                        textShadow: "0 0 5px red",
                      }}
                    >
                      CHAMADA Nº {numero_chamada}
                    </span>
                  )}
                </div>

                <div className="w-full text-center pt-4 border-t border-white border-opacity-20 mt-4">
                  <span className="text-5xl font-bold">{consultorio}</span>
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {/* Animações */}
      <style jsx>{`
        @keyframes piscar {
          0%,
          100% {
            color: white;
            text-shadow: 0 0 5px red;
          }
          50% {
            color: red;
            text-shadow: 0 0 10px white;
          }
        }
        .fade-in {
          animation: fadeInScale 0.6s ease-out;
        }
        @keyframes fadeInScale {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </main>
  );
}
