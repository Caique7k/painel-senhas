"use client";
import { useEffect, useRef, useState } from "react";

export type Senha = {
  id: string;
  seq?: number;
  paciente: string;
  consultorio: string;
  audio_url: string | null;
  timestamp: number; // em milissegundos
  idade?: number; // segundos desde a chamada, calculado pelo servidor
  numero_chamada?: number;
  nao_atendido?: boolean;
};

const API = process.env.NEXT_PUBLIC_API_URL;
// Quanto tempo o servidor segura cada requisição esperando uma chamada nova.
const ESPERA_SERVIDOR_S = 20;
// Ao abrir/recarregar o painel, só fala chamadas bem recentes (não repete as antigas).
const IDADE_MAX_AO_ABRIR_S = 15;
// Depois de uma queda de rede, ainda fala chamadas de até 90s atrás.
const IDADE_MAX_REPRODUCAO_S = 90;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Baixa o MP3 inteiro antes de tocar, com tempo limite e novas tentativas.
async function baixarAudio(url: string, tentativas = 3): Promise<string | null> {
  for (let i = 0; i < tentativas; i++) {
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), 8000);
    try {
      const res = await fetch(url, { signal: controle.signal });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0) return URL.createObjectURL(blob);
      }
    } catch (err) {
      console.warn("Falha ao baixar áudio, tentativa", i + 1, err);
    } finally {
      clearTimeout(limite);
    }
    await esperar(700);
  }
  return null;
}

// Toca o áudio e SEMPRE resolve: no fim, em erro, ou se travar (tempo limite).
// Antes, um áudio travado deixava a fila parada para sempre até recarregar a TV.
function tocarAudio(src: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(src);
    let terminou = false;
    let guarda: ReturnType<typeof setTimeout>;
    const terminar = () => {
      if (terminou) return;
      terminou = true;
      clearTimeout(guarda);
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      resolve();
    };
    guarda = setTimeout(terminar, 30000);
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        clearTimeout(guarda);
        guarda = setTimeout(terminar, audio.duration * 1000 + 3000);
      }
    };
    audio.onended = terminar;
    audio.onerror = terminar;
    audio.play().catch((err) => {
      console.error(
        "Erro ao reproduzir áudio (clique na tela do painel para liberar o som):",
        err
      );
      terminar();
    });
  });
}

export function usePainelChamadas(setor: string) {
  const [ultimasChamadas, setUltimasChamadas] = useState<Senha[]>([]);
  const [chamadaAtual, setChamadaAtual] = useState<Senha | null>(null);

  const audioCtx = useRef<AudioContext | null>(null);
  const fila = useRef<Senha[]>([]);
  const tocando = useRef(false);
  const vistos = useRef<Map<string, number>>(new Map());

  // Um único AudioContext para o painel inteiro (antes era criado um novo a cada
  // bip e nunca fechado, o que esgota o áudio do navegador depois de muitas chamadas).
  const obterAudioCtx = () => {
    if (!audioCtx.current) audioCtx.current = new AudioContext();
    if (audioCtx.current.state === "suspended") {
      audioCtx.current.resume().catch(() => {});
    }
    return audioCtx.current;
  };

  const tocarBeep = async () => {
    try {
      const ctx = obterAudioCtx();
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
    } catch (err) {
      console.error("Erro ao tocar bip:", err);
    }
    await esperar(1000);
  };

  // Libera o áudio no primeiro clique na tela (exigência dos navegadores).
  useEffect(() => {
    const handleClick = () => {
      obterAudioCtx();
      window.removeEventListener("click", handleClick);
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const processarFila = async () => {
    if (tocando.current) return;
    tocando.current = true;
    try {
      while (fila.current.length > 0) {
        const chamada = fila.current.shift()!;
        setChamadaAtual(chamada);

        const url = chamada.audio_url ? `${API}${chamada.audio_url}` : null;
        // Baixa o áudio enquanto o bip toca, para não perder tempo.
        const download = url ? baixarAudio(url) : Promise.resolve(null);
        await tocarBeep();
        if (url) {
          const src = await download;
          await tocarAudio(src ?? url);
          if (src) URL.revokeObjectURL(src);
        }
        await esperar(300);
      }
    } catch (err) {
      console.error("Erro na fila de áudio:", err);
    } finally {
      tocando.current = false;
    }
  };

  const receberChamadas = (lista: Senha[], primeiraCarga: boolean) => {
    const agora = Date.now();
    for (const [id, quando] of vistos.current) {
      if (agora - quando > 15 * 60 * 1000) vistos.current.delete(id);
    }

    const novas = lista
      .filter((c) => !vistos.current.has(c.id))
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
      .map((c) => ({ ...c, timestamp: c.timestamp * 1000 }));
    if (novas.length === 0) return;

    const idadeMax = primeiraCarga ? IDADE_MAX_AO_ABRIR_S : IDADE_MAX_REPRODUCAO_S;
    for (const senha of novas) {
      vistos.current.set(senha.id, agora);
      if (!senha.nao_atendido && (senha.idade ?? 0) <= idadeMax) {
        fila.current.push(senha);
      }
    }

    // Lista de últimas chamadas (até 4), uma por paciente/consultório, mais recente primeiro.
    setUltimasChamadas((old) =>
      novas.reduce(
        (acc, senha) =>
          [
            senha,
            ...acc.filter(
              (c) =>
                c.paciente !== senha.paciente ||
                c.consultorio !== senha.consultorio
            ),
          ].slice(0, 4),
        old
      )
    );

    processarFila();
  };

  // Long-polling: o servidor responde assim que houver chamada nova (sem esperar 5s).
  useEffect(() => {
    let ativo = true;
    let controle: AbortController | null = null;
    let boot = "";
    let seq = 0;
    let primeira = true;

    const loop = async () => {
      while (ativo) {
        controle = new AbortController();
        const limite = setTimeout(
          () => controle?.abort(),
          (ESPERA_SERVIDOR_S + 15) * 1000
        );
        try {
          const params = new URLSearchParams({
            setor,
            desde: String(seq),
            boot,
            espera: String(primeira ? 0 : ESPERA_SERVIDOR_S),
          });
          const res = await fetch(`${API}/eventos?${params}`, {
            signal: controle.signal,
            cache: "no-store",
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data: { boot: string; seq: number; chamadas: Senha[] } =
            await res.json();
          boot = data.boot;
          seq = data.seq;
          receberChamadas(data.chamadas, primeira);
          primeira = false;
        } catch (error) {
          if (!ativo) break;
          console.error("Erro ao buscar chamadas:", error);
          await esperar(2000);
        } finally {
          clearTimeout(limite);
        }
      }
    };

    loop();
    return () => {
      ativo = false;
      controle?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setor]);

  return { chamadaAtual, ultimasChamadas };
}
