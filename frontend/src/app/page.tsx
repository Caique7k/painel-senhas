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

  const consultorios = ["Triagem"];
  const [mostrarModal, setMostrarModal] = useState(false);
  const [dataRelatorio, setDataRelatorio] = useState("");
  // Função para truncar texto
  function truncate(text: string, maxLength: number) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  }

  const [erroRelatorio, setErroRelatorio] = useState("");

  const gerarRelatorio = async (tipo: "atendidos" | "nao-atendidos") => {
    if (!dataRelatorio) return;

    try {
      setErroRelatorio("");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/relatorio-${tipo}?data=${dataRelatorio}`
      );

      if (!response.ok) {
        const data = await response.json();
        setErroRelatorio(data.detail || "Erro ao gerar relatório.");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setErroRelatorio("Erro de conexão com o servidor.");
    }
  };

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
      formData.append("consultorio", consultorio);
      formData.append("setor", "ps");
      formData.append("nome_paciente", nomePaciente.trim());

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chamar`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao chamar paciente");
      }

      const data = await response.json();
      if (data.error) {
        setToast({
          message: data.error,
          type: "error",
        });
        return;
      } else {
        setToast({ message: "Enviado com sucesso!", type: "success" });
      }
    } catch (error) {
      setToast({
        message: (error as Error).message || "Erro desconhecido",
        type: "error",
      });
    }
  };

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 relative">
        <h1 className="mb-10 text-4xl font-extrabold text-white drop-shadow-lg">
          Painel de Senhas - Pronto Socorro
        </h1>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-800 rounded-xl p-8 shadow-xl w-full max-w-md"
          noValidate
        >
          <label className="block mb-6 relative">
            <span className="text-gray-300 font-semibold">
              Nome do paciente
            </span>
            <div className="relative mt-2">
              <FaUser
                className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 pointer-events-none"
                size={18}
              />
              <input
                type="text"
                value={nomePaciente}
                onChange={(e) => setNomePaciente(e.target.value.toUpperCase())} // sempre MAIÚSCULO
                placeholder="Digite o nome completo"
                className="pl-10 block w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400 focus:outline-none transition uppercase" // uppercase para forçar visualmente
                autoFocus
              />
            </div>
          </label>

          <label className="block mb-8 relative">
            <span className="text-gray-300 font-semibold">Setor</span>
            <div className="relative mt-2">
              <FaClinicMedical
                className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 pointer-events-none"
                size={18}
              />
              <select
                value={consultorio}
                onChange={(e) => setConsultorio(e.target.value)}
                className="pl-10 block w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400 focus:outline-none transition cursor-pointer"
              >
                <option value="" disabled>
                  Selecione o setor
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
          <button
            type="button"
            onClick={() => setMostrarModal(true)}
            className="w-full mt-4 rounded-lg border border-indigo-500 text-indigo-300 py-2 font-semibold hover:bg-indigo-700 hover:text-white transition cursor-pointer"
          >
            📄 Gerar relatório
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
        {mostrarModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
            <div className="bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-sm text-white">
              <h2 className="text-xl font-bold mb-4">Relatório</h2>
              <label className="block mb-4">
                <span className="text-gray-300 font-semibold">Data</span>
                <input
                  type="date"
                  value={dataRelatorio}
                  onChange={(e) => setDataRelatorio(e.target.value)}
                  className="block w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              {erroRelatorio && (
                <p className="text-red-400 text-sm mt-2">{erroRelatorio}</p>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setMostrarModal(false);
                    setErroRelatorio("");
                  }}
                  className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => gerarRelatorio("nao-atendidos")}
                  disabled={!dataRelatorio}
                  className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500 font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Baixar PDF Não Atendidos
                </button>
                <button
                  onClick={() => gerarRelatorio("atendidos")}
                  disabled={!dataRelatorio}
                  className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Baixar PDF de Chamados
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
