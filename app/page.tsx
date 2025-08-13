"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/* ---- Tipos (TS) ---- */
type ExamPoint = {
  date: string;
  ureia: number;
  creatinina: number;
  leucocitos: number;
};

type EventAnalysis = Partial<Omit<ExamPoint, "date">> & { notas?: string };

type EventItem = {
  date: string;
  event: string;
  details: string;
  fileUrl?: string;        // URL do arquivo no Blob
  analysis?: EventAnalysis; // Dados extraídos (texto ou IA)
};

function parseNumber(n: string | undefined) {
  if (!n) return undefined;
  const v = parseFloat(n.replace(",", "."));
  return Number.isFinite(v) ? v : undefined;
}

// tenta extrair números do campo "Detalhes"
function extractFromText(details: string): EventAnalysis | undefined {
  if (!details?.trim()) return undefined;
  const txt = details.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  const ureia = parseNumber(txt.match(/ureia[^0-9]*([0-9]+(?:[.,][0-9]+)?)/i)?.[1]);
  const creatinina = parseNumber(txt.match(/creatinina[^0-9]*([0-9]+(?:[.,][0-9]+)?)/i)?.[1]);
  const leucocitos = parseNumber(txt.match(/leucocitos?[^0-9]*([0-9]+(?:[.,][0-9]+)?)/i)?.[1]);

  if (ureia !== undefined || creatinina !== undefined || leucocitos !== undefined) {
    return { ureia, creatinina, leucocitos, notas: "Valores lidos do campo Detalhes." };
  }
  return undefined;
}

export default function App() {
  const [timeline, setTimeline] = useState<EventItem[]>([]);
  const [examData, setExamData] = useState<ExamPoint[]>([
    { date: "2025-08-12", ureia: 60, creatinina: 1.6, leucocitos: 13800 },
  ]);
  const [examExplanation, setExamExplanation] = useState(
    "Hemograma: leucócitos elevados (13.800/µL) → indica resposta inflamatória."
  );
  const [suspeitas] = useState<string[]>([
    "Reação adversa à Macrodantina",
    "Desidratação",
    "Infecção urinária",
  ]);
  const [resumo] = useState(
    "Paciente apresentou vômitos, desidratação e sinais vitais instáveis. Internada para hidratação e investigação."
  );
  const [proximosPassos] = useState<string[]>([
    "Aguardar resultado da cultura de urina",
    "Reavaliar necessidade de tomografia",
    "Manter hidratação",
  ]);

  // formulário
  const [newEvent, setNewEvent] = useState<EventItem>({
    date: "",
    event: "",
    details: "",
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Carrega timeline persistida
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/events");
        if (res.ok) {
          const data = (await res.json()) as EventItem[];
          setTimeline(data);
        } else {
          setTimeline([
            {
              date: "2025-08-12",
              event: "Internação por desidratação",
              details: "Pressão baixa, taquicardia, vômitos",
            },
          ]);
        }
      } catch {
        setTimeline([
          {
            date: "2025-08-12",
            event: "Internação por desidratação",
            details: "Pressão baixa, taquicardia, vômitos",
          },
        ]);
      }
    })();
  }, []);

  async function persistTimeline(updated: EventItem[]) {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  }

  function explainLeucocitos(prev: number, curr: number) {
    if (curr > prev) return `Leucócitos subiram (${curr.toLocaleString("pt-BR")}/µL) — possível piora.`;
    if (curr < prev) return `Leucócitos caíram (${curr.toLocaleString("pt-BR")}/µL) — possível melhora.`;
    return `Leucócitos estáveis (${curr.toLocaleString("pt-BR")}/µL).`;
  }

  // BOTÃO "Adicionar"
  const handleAddEvent = async () => {
    if (!newEvent.date || !newEvent.event) {
      alert("Informe data e evento.");
      return;
    }

    setIsSaving(true);
    try {
      // 1) sobe arquivo se existir
      let fileUrl: string | undefined;
      if (pendingFile) {
        const form = new FormData();
        form.append("file", pendingFile);
        const up = await fetch("/api/upload", { method: "POST", body: form });
        if (up.ok) {
          ({ url: fileUrl } = (await up.json()) as { url: string });
        } else {
          alert("Falha no upload do arquivo.");
        }
      }

      // 2) tenta extrair valores do campo Detalhes
      let analysis: EventAnalysis | undefined = extractFromText(newEvent.details);

      // 3) se não veio nada e temos arquivo → IA
      if (!analysis && fileUrl) {
        const resp = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl }),
        });
        if (resp.ok) {
          analysis = (await resp.json()) as EventAnalysis;
        }
      }

      // 4) monta o evento final
      const eventToSave: EventItem = {
        ...newEvent,
        fileUrl,
        analysis,
      };

      // 5) atualiza gráfico se houver qualquer valor
      if (analysis && (analysis.ureia !== undefined || analysis.creatinina !== undefined || analysis.leucocitos !== undefined)) {
        const last = examData[examData.length - 1];
        const nextPoint: ExamPoint = {
          date: newEvent.date,
          ureia: analysis.ureia ?? last.ureia,
          creatinina: analysis.creatinina ?? last.creatinina,
          leucocitos: analysis.leucocitos ?? last.leucocitos,
        };
        setExamData((prev) => [...prev, nextPoint]);

        if (analysis.leucocitos !== undefined) {
          setExamExplanation(explainLeucocitos(last.leucocitos, analysis.leucocitos));
        }
      }

      const updated = [...timeline, eventToSave];
      setTimeline(updated);
      await persistTimeline(updated);

      // limpa formulário
      setNewEvent({ date: "", event: "", details: "" });
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  // UI auxiliar para “Dados atualizados”
  function renderAnalysis(a?: EventAnalysis) {
    if (!a || (a.ureia === undefined && a.creatinina === undefined && a.leucocitos === undefined))
      return "—";
    const parts: string[] = [];
    if (a.ureia !== undefined) parts.push(`Ureia: ${a.ureia}`);
    if (a.creatinina !== undefined) parts.push(`Creatinina: ${a.creatinina}`);
    if (a.leucocitos !== undefined) parts.push(`Leucócitos: ${a.leucocitos.toLocaleString("pt-BR")}`);
    return parts.join(" | ");
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold">Histórico Clínico - Mamãe</h1>

      {/* TABELA da Timeline */}
      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-4">📅 Timeline</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Evento</th>
                <th className="py-2 pr-4">Dados atualizados</th>
                <th className="py-2 pr-4">Download</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((item, idx) => (
                <tr key={idx} className="border-b align-top">
                  <td className="py-2 pr-4 whitespace-nowrap">{item.date}</td>
                  <td className="py-2 pr-4">
                    <div className="font-semibold">{item.event}</div>
                    {item.details && <div className="text-gray-600 mt-1">{item.details}</div>}
                  </td>
                  <td className="py-2 pr-4">{renderAnalysis(item.analysis)}</td>
                  <td className="py-2 pr-4">
                    {item.fileUrl ? (
                      <a
                        href={item.fileUrl}
                        download
                        className="inline-block bg-blue-600 text-white px-3 py-1 rounded hover:opacity-90"
                      >
                        Baixar
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráfico */}
      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-2">📊 Evolução dos Exames</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={examData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="ureia" stroke="#8884d8" />
            <Line type="monotone" dataKey="creatinina" stroke="#82ca9d" />
            <Line type="monotone" dataKey="leucocitos" stroke="#ff7300" />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-2 text-sm text-gray-700">{examExplanation}</p>
      </div>

      {/* Blocos estáticos */}
      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-2">🔍 Principais Suspeitas</h2>
        <ul className="list-disc ml-5">{suspeitas.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </div>

      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-2">📝 Resumo do Quadro</h2>
        <p>{resumo}</p>
      </div>

      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-2">⏭ Próximos Passos</h2>
        <ul className="list-disc ml-5">{proximosPassos.map((p, i) => <li key={i}>{p}</li>)}</ul>
      </div>

      {/* Formulário — upload ANTES do Adicionar */}
      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-2">➕ Adicionar Novo Evento</h2>

        <div className="flex flex-wrap gap-2 mb-2">
          <input
            type="date"
            value={newEvent.date}
            onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
            className="border p-1 rounded"
          />
          <input
            type="text"
            placeholder="Evento"
            value={newEvent.event}
            onChange={(e) => setNewEvent({ ...newEvent, event: e.target.value })}
            className="border p-1 rounded flex-1 min-w-[220px]"
          />
        </div>

        <textarea
          placeholder="Detalhes (se deixar em branco, a IA tenta ler o arquivo)"
          value={newEvent.details}
          onChange={(e) => setNewEvent({ ...newEvent, details: e.target.value })}
          className="border p-1 rounded w-full mb-2"
        />

        <div className="mb-3">
          <label className="block mb-1 font-medium">📎 Upload de Arquivo de Exame</label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
            className="border p-1 rounded"
          />
          <p className="text-xs text-gray-500 mt-1">
            Se “Detalhes” ficar vazio, vou tentar extrair Ureia, Creatinina e Leucócitos do arquivo usando IA.
          </p>
        </div>

        <button
          onClick={handleAddEvent}
          disabled={isSaving}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          {isSaving ? "Salvando..." : "Adicionar"}
        </button>
      </div>
    </div>
  );
}
