"use client";
import { useState, useEffect } from "react";
import { usePainelChamadas } from "@/lib/usePainelChamadas";

export default function Painel() {
  const { chamadaAtual, ultimasChamadas } = usePainelChamadas("pa");
  const [horaAtual, setHoraAtual] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const fraseAnoNovo = "";

  useEffect(() => {
    setMounted(true); // indica que estamos no cliente
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main
      className="relative min-h-screen w-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: "#24235c" }}
    >
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
              Santa Casa de Misericórdia de Guaíra
            </h1>
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
      <footer className="relative z-10 text-center text-white/60 text-2xl p-4 border-t border-white/20">
        {fraseAnoNovo}
      </footer>
    </main>
  );
}
