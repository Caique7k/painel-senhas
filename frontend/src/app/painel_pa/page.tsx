"use client";
import { useState, useEffect } from "react";

type Senha = {
  id: string;
  paciente: string;
  consultorio: string;
  audio_url: string;
  timestamp: number; // para controlar o tempo que está na tela
  numero_chamada?: number;
};

export default function Painel() {
  const [senhas, setSenhas] = useState<Senha[]>([]);
  const [audioLiberado, setAudioLiberado] = useState(false);
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

    return () => {
      window.removeEventListener("click", handleClick);
    };
  }, []);
  // Função para tocar beep curto
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
  // Função para tocar alerta e depois o áudio do backend
  const tocarAudio = (url: string) => {
    tocarBeep();
    setTimeout(() => {
      const audio = new Audio(`${process.env.NEXT_PUBLIC_API_URL}${url}`);

      audio.onerror = () => console.error("Erro ao carregar áudio!");
      audio.play();
    }, 1000);
  };
  // Buscar chamadas a cada 5 segundos

  useEffect(() => {
    const buscarChamadas = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/ultimas-chamadas?setor=pa`
        );
        const data: Senha[] = await res.json();

        setSenhas((prev) => {
          const agora = Date.now();

          const chamadasComTimestampMs = data.map((chamada) => ({
            ...chamada,
            timestamp: chamada.timestamp * 1000,
          }));

          // Junta antigas + novas, mas com regra da triagem
          const atualizadas = [...prev, ...chamadasComTimestampMs]
            .filter((chamada) => agora - chamada.timestamp < 180000)
            .reduce<Senha[]>((acc, chamada) => {
              const normalizado = chamada.consultorio.trim().toLowerCase();

              if (normalizado === "triagem") {
                // Substitui qualquer outra chamada da triagem
                return [
                  ...acc.filter(
                    (c) => c.consultorio.trim().toLowerCase() !== "triagem"
                  ),
                  chamada,
                ];
              }

              // Remove qualquer chamada do mesmo consultório (independente do paciente)
              const restante = acc.filter(
                (c) => c.consultorio.trim().toLowerCase() !== normalizado
              );

              return [...restante, chamada];
            }, []);

          // Identifica quais realmente são novas no painel final
          const idsAntigos = new Set(prev.map((s) => s.id));
          const idsAtuais = new Set(atualizadas.map((s) => s.id));

          const novosParaTocar = atualizadas.filter(
            (s) => !idsAntigos.has(s.id)
          );

          // Toca som só dos que ficaram de fato no painel
          novosParaTocar.forEach((s) => tocarAudio(s.audio_url));

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

      {/* Envolvendo o grid para centralização */}
      <div className="w-full flex justify-center">
        <section
          className="grid"
          style={{
            maxWidth: "1300px",
            width: "100%",
            gap: "30px 60px", // reduz o espaço entre as linhas
            display: "grid",
            gridTemplateColumns:
              senhas.length === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))",
            gridTemplateRows: senhas.length <= 2 ? "1fr" : "repeat(2, auto)",
            alignItems: "start",
            justifyItems: "center",
            paddingBottom: "10px", // reduz espaço inferior
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
                style={{
                  width: "580px",
                  height: "300px", // altura levemente reduzida
                }}
              >
                <div className="flex-grow w-full flex flex-col items-center justify-center px-4">
                  <span
                    className="text-5xl font-bold text-center leading-snug break-words"
                    style={{
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {paciente.length > 30
                      ? paciente.slice(0, 30) + "..."
                      : paciente}
                  </span>

                  {numero_chamada && numero_chamada > 1 && (
                    <span
                      className="mt-3 font-bold text-center"
                      style={{
                        fontSize: "1.9rem",
                        animation: "piscar 1s infinite",
                        color: "white",
                        textShadow: "0 0 5px red",
                        maxWidth: "100%",
                        wordBreak: "break-word",
                        overflowWrap: "break-word",
                        whiteSpace: "normal",
                      }}
                    >
                      CHAMADA Nº {numero_chamada}
                    </span>
                  )}
                </div>

                <div className="w-full text-center mt-auto pt-2 border-t border-white border-opacity-20">
                  <span className="text-5xl font-bold">{consultorio}</span>
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {/* Animação */}
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
