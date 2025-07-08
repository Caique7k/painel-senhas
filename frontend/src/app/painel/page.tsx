"use client";
import { useState } from "react";

type Senha = {
  id: number;
  paciente: string;
  consultorio: string;
};

export default function Painel() {
  const [senhas, setSenhas] = useState<Senha[]>([
    { id: 1, paciente: "João Silva", consultorio: "Consultório 1" },
    { id: 2, paciente: "Maria Souza", consultorio: "Consultório 2" },
    { id: 3, paciente: "Carlos Lima", consultorio: "Consultório 3" },
  ]);

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
              <span className="text-[12rem] font-extrabold drop-shadow select-none">
                {id}
              </span>
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
