"use client";
import { useState, useEffect } from "react";
import { FaUser, FaClinicMedical } from "react-icons/fa";

type ToastProps = {
  message: string;
  type?: "error" | "success";
  onClose: () => void;
};

function Toast({ message, type = "error", onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-5 right-5 z-50 flex items-center rounded shadow-lg px-4 py-3 text-white font-semibold
      ${
        type === "error"
          ? "bg-red-600"
          : type === "success"
          ? "bg-green-600"
          : "bg-gray-600"
      }
      animate-fadeInDown`}
      role="alert"
    >
      <span className="mr-4">{message}</span>
      <button
        aria-label="Fechar notificação"
        onClick={onClose}
        className="ml-auto font-bold hover:text-gray-300 transition"
      >
        &times;
      </button>
    </div>
  );
}

export default function Home() {
  const [nomePaciente, setNomePaciente] = useState<string>("");
  const [consultorio, setConsultorio] = useState<string>("");
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  const consultorios = ["Consultório 1", "Consultório 2", "Consultório 3"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nomePaciente || !consultorio) {
      setToast({
        message: "Por favor, preencha todos os campos.",
        type: "error",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("nome_paciente", nomePaciente);
      formData.append("consultorio", consultorio);
      formData.append("setor", "pa");

      const response = await fetch("http://localhost:8000/chamar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao chamar paciente");
      }

      const data = await response.json();

      setToast({ message: "Enviado com sucesso!", type: "success" });
      setNomePaciente("");
      setConsultorio("");
    } catch (error) {
      setToast({
        message: (error as Error).message || "Erro desconhecido",
        type: "error",
      });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 relative">
      <h1 className="mb-10 text-4xl font-extrabold text-white drop-shadow-lg">
        Painel de Senhas
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 rounded-xl p-8 shadow-xl w-full max-w-md"
        noValidate
      >
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

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Animação keyframes fadeInDown no globals.css */}
      <style jsx global>{`
        @keyframes fadeInDown {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInDown {
          animation: fadeInDown 0.3s ease forwards;
        }
      `}</style>
    </main>
  );
}
