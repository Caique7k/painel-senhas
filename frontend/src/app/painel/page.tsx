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
      <div className="w-full flex flex-col items-center">
        {/* Header com logo e título centralizados */}
        <header className="flex items-center gap-8 mb-16 justify-center w-full">
          <img
            src="/logo-santa-casa.jpg"
            alt="Santa Casa Logo"
            className="h-32 w-auto rounded-md shadow-lg"
          />
          <h1 className="text-white text-7xl font-extrabold drop-shadow-lg whitespace-nowrap">
            Painel de Senhas
          </h1>
        </header>

        {/* Lista de senhas */}
        <section className="w-full flex justify-center items-stretch gap-16 px-8">
          {senhas.length === 0 ? (
            <p className="text-white text-opacity-70 text-3xl">
              Nenhuma senha chamada ainda.
            </p>
          ) : (
            senhas.map(({ id, paciente, consultorio }) => (
              <div
                key={id}
                className="bg-gradient-to-r from-indigo-700 to-purple-900 text-white px-24 py-16 rounded-3xl shadow-2xl flex flex-col items-center min-w-[500px] max-w-[600px]"
              >
                <span className="text-[14rem] font-extrabold drop-shadow select-none leading-none">
                  {id}
                </span>
                <span className="text-6xl mt-10 font-bold text-center leading-snug">
                  {paciente}
                </span>
                <span className="mt-10 text-5xl font-semibold text-center">
                  {consultorio}
                </span>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
