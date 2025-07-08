"use client";
import { useState, useEffect } from "react";

type Senha = {
  id: string;
  paciente: string;
  consultorio: string;
  audio_url: string;
  timestamp: number; // para controlar o tempo que está na tela
};

export default function Painel() {
  const [senhas, setSenhas] = useState<Senha[]>([]);

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
      const audio = new Audio(`http://localhost:8000${url}`);
      audio.play();
    }, 1000);
  };
  // Buscar chamadas a cada 5 segundos

  useEffect(() => {
    const buscarChamadas = async () => {
      try {
        const res = await fetch("http://localhost:8000/ultimas-chamadas");
        const data: Senha[] = await res.json();

        setSenhas((prev) => {
          const agora = Date.now();

          // Normaliza timestamps para milissegundos
          const chamadasComTimestampMs = data.map((chamada) => ({
            ...chamada,
            timestamp: chamada.timestamp * 1000,
          }));

          // Filtra chamadas novas (que ainda não estão)
          const novas = chamadasComTimestampMs.filter(
            (d) => !prev.some((p) => p.id === d.id)
          );

          // Tocar áudio das novas chamadas
          novas.forEach((nova) => tocarAudio(nova.audio_url));

          // Combina as antigas e novas, removendo as que passaram de 3 minutos (180000 ms)
          const atualizadas = [...prev, ...novas].filter(
            (chamada) => agora - chamada.timestamp < 180000
          );

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
          senhas.map(({ id, paciente, consultorio }) => (
            <div
              key={id}
              className="bg-gradient-to-r from-indigo-700 to-purple-900 text-white p-16 rounded-lg shadow-xl flex flex-col items-center min-w-[320px]"
              style={{ flex: "1 1 0", maxWidth: "380px" }}
            >
              <span className="text-5xl mt-6 font-semibold text-center">
                {paciente}
              </span>
              <span className="mt-10 text-3xl font-medium">{consultorio}</span>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
