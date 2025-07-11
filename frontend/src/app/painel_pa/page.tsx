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
      className="min-h-screen w-screen p-12 flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: "#24235c" }}
    >
      {/* Header com logo e título */}
      <header className="flex items-center gap-8 mb-16">
        <img
          src="/logo-santa-casa.jpg"
          alt="Santa Casa Logo"
          className="h-28 w-auto rounded-md shadow-lg"
        />
        <h1 className="text-white text-7xl font-extrabold drop-shadow-lg whitespace-nowrap">
          Painel de Senhas
        </h1>
      </header>

      {/* Lista de senhas: exibe em linha com espaçamento */}
      <section className="w-full max-w-full flex justify-center gap-20">
        {senhas.length === 0 ? (
          <p className="text-white text-opacity-70 text-3xl">
            Nenhuma senha chamada ainda.
          </p>
        ) : (
          senhas.map(({ id, paciente, consultorio, numero_chamada }) => (
            <div
              key={id}
              className="bg-gradient-to-r from-indigo-700 to-purple-900 text-white px-12 py-10 rounded-3xl shadow-xl flex flex-col justify-between items-center min-w-[320px]"
              style={{
                flex: "1 1 0",
                maxWidth: "400px",
                maxHeight: "600px",
                overflowY: "auto",
              }}
            >
              {/* Nome do paciente centralizado */}
              <div className="flex-grow w-full flex flex-col items-center justify-center px-4">
                <span
                  className="text-5xl font-semibold text-center leading-snug break-words max-w-full"
                  style={{
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                    display: "-webkit-box",
                    WebkitLineClamp: 3, // limita a 3 linhas
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {paciente}
                </span>

                {numero_chamada && numero_chamada > 1 && (
                  <span
                    className="mt-4 font-bold text-center"
                    style={{
                      fontSize: "2.5rem",
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
                `}</style>
              </div>

              {/* Consultório fixado na parte inferior */}
              <div className="w-full text-center mt-auto pt-4 border-t border-white border-opacity-20">
                <span className="text-4xl font-bold">{consultorio}</span>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
