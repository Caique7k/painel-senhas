"use client";
import { useState, useEffect, useRef } from "react";

type Senha = {
  id: string;
  paciente: string;
  consultorio: string;
  audio_url: string;
  timestamp: number;
  numero_chamada?: number;
  nao_atendido?: boolean;
};

export default function Painel() {
  const [senhas, setSenhas] = useState<Senha[]>([]);
  const [ultimasChamadas, setUltimasChamadas] = useState<Senha[]>([]);
  const [chamadaAtual, setChamadaAtual] = useState<Senha | null>(null);
  const [horaAtual, setHoraAtual] = useState(new Date());
  const [audioLiberado, setAudioLiberado] = useState(false);

  const historicoAudios = useRef<
    { paciente: string; consultorio: string; time: number }[]
  >([]);
  const filaAudios = useRef<Senha[]>([]);
  const tocando = useRef(false);

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

  const processarFila = () => {
    if (tocando.current || filaAudios.current.length === 0) return;
    tocando.current = true;

    const chamada = filaAudios.current.shift();
    if (!chamada) {
      tocando.current = false;
      return;
    }

    setChamadaAtual(chamada);

    if (chamada.nao_atendido) {
      // Chamada não atendida: não toca áudio, só exibe no painel
      tocando.current = false;
      processarFila();
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
        tocando.current = false;
        processarFila();
      };
    }, 1000);
  };

  const adicionarNaFila = (senha: Senha) => {
    const agora = Date.now();

    // Atualiza o histórico de áudio para evitar repetição
    historicoAudios.current = historicoAudios.current.filter(
      (h) => agora - h.time < 3000
    );
    const repetido = historicoAudios.current.some(
      (h) =>
        h.paciente === senha.paciente && h.consultorio === senha.consultorio
    );
    if (!repetido) {
      historicoAudios.current.push({
        paciente: senha.paciente,
        consultorio: senha.consultorio,
        time: agora,
      });

      // Se for chamada normal, adiciona na fila de áudio
      if (!senha.nao_atendido) {
        filaAudios.current.push(senha);
        processarFila();
      }
    }

    // Atualiza sempre a lista de últimas chamadas (com até 4)
    setUltimasChamadas((old) => {
      const atualizadas = old.filter(
        (c) =>
          c.paciente !== senha.paciente || c.consultorio !== senha.consultorio
      );
      return [senha, ...atualizadas].slice(0, 4);
    });
  };

  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const buscarChamadas = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/ultimas-chamadas?setor=pa`
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
              return [
                ...acc.filter(
                  (c) => c.consultorio.trim().toLowerCase() !== normalizado
                ),
                chamada,
              ];
            }, []);

          const idsAntigos = new Set(prev.map((s) => s.id));
          const novasChamadas = atualizadas.filter(
            (s) => !idsAntigos.has(s.id)
          );
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
      className="min-h-screen w-screen flex flex-col"
      style={{ backgroundColor: "#24235c" }}
    >
      {/* Header */}
      <header className="flex justify-between items-center px-8 py-4 border-b border-white/20">
        <div className="flex items-center gap-4">
          <img
            src="/logo-santa-casa.jpg"
            alt="Santa Casa Logo"
            className="h-20 w-auto"
          />
          <h1 className="text-white text-4xl font-bold">
            Santa Casa de Misericórdia de Guaíra
          </h1>
        </div>
        <div className="text-right text-white text-2xl">
          <p>
            {horaAtual.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p>{horaAtual.toLocaleDateString("pt-BR")}</p>
        </div>
      </header>

      {/* Paciente Atual */}
      <div className="flex-1 flex flex-col items-center justify-center">
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
      <div className="bg-white/10 p-4">
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
    </main>
  );
}
