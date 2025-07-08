"use client";
import { useState, useEffect } from "react";
import { FaUser, FaClinicMedical } from "react-icons/fa";

export default function Home() {
  const [nomePaciente, setNomePaciente] = useState<string>("");
  const [consultorio, setConsultorio] = useState<string>("");
  const [erro, setErro] = useState<string>("");

  const consultorios = ["Consultório 1", "Consultório 2", "Consultório 3"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nomePaciente || !consultorio) {
      setErro("Por favor, preencha todos os campos.");
      return;
    }

    alert(`Nome do Paciente: ${nomePaciente}\nConsultório: ${consultorio}`);
    setNomePaciente("");
    setConsultorio("");
    setErro("");
  };

  // Limpa a mensagem de erro após 3 segundos
  useEffect(() => {
    if (erro) {
      const timer = setTimeout(() => setErro(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [erro]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <h1 className="mb-10 text-4xl font-extrabold text-white drop-shadow-lg">
        Painel de Senhas
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 rounded-xl p-8 shadow-xl w-full max-w-md"
        noValidate
      >
        {erro && (
          <div className="mb-6 rounded bg-red-600 px-4 py-3 text-white font-semibold animate-pulse">
            {erro}
          </div>
        )}

        <label className="block mb-6 relative">
          <span className="text-gray-300 font-semibold">Nome do paciente</span>
          <div className="relative mt-2">
            <FaUser
              className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 pointer-events-none"
              size={18}
            />
            <input
              type="text"
              value={nomePaciente}
              onChange={(e) => setNomePaciente(e.target.value)}
              placeholder="Digite o nome completo"
              className="pl-10 block w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400 focus:outline-none transition"
              autoFocus
            />
          </div>
        </label>

        <label className="block mb-8 relative">
          <span className="text-gray-300 font-semibold">Consultório</span>
          <div className="relative mt-2">
            <FaClinicMedical
              className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 pointer-events-none"
              size={18}
            />
            <select
              value={consultorio}
              onChange={(e) => setConsultorio(e.target.value)}
              className="pl-10 block w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400 focus:outline-none transition"
            >
              <option value="" disabled>
                Selecione o consultório
              </option>
              {consultorios.map((c, idx) => (
                <option key={idx} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-700 py-3 text-white font-semibold shadow-lg hover:scale-105 hover:shadow-xl transition cursor-pointer focus:outline-none focus:ring-4 focus:ring-indigo-400"
        >
          Chamar paciente
        </button>
      </form>
    </main>
  );
}
