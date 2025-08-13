"use client";
import React, { useEffect, useState } from "react";
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
  analysis?: EventAnalysis; // Dados “considerados” ao analisar o arquivo
};

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
  const [newEvent, setNewEvent] = useState<EventItem>({
    date: "",
    event: "",
    details: "",
  });
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

  // Salva a timeline inteira no backend
  async function persistTimeline(updated: EventItem[]) {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  }

  const handleAddEvent = async () => {
    if (!newEvent.date || !newEvent.event) return;
    const updated = [...timeline, newEvent];
    setIsSaving(true);
    try {
      await persistTimeline(updated);
      setTimeline(updated);
      setNewEvent({ date: "", event: "", details: "" });
    } catch {
      alert("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  // Ajuda a criar uma explicação simples para o hemograma
  function explainLeucocitos(prev: number, curr: number) {
    if (curr > prev) return `Leucócitos subiram (${curr.toLocaleString("pt-BR")}/µL) — possível piora.`;
    if (curr < prev) return `Leucócitos caíram (${curr.toLocaleString("pt-BR")}/µL) — possível melhora.`;
    return `Leucócitos estáveis (${curr.toLocaleString("pt-BR")}/µL).`;
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1) Envia para a API que grava no Blob
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) {
      alert("Falha no upload");
      return;
    }
    const { url } = (await res.json()) as { url: string };

    // 2) Coleta valores do exame (MVP: via prompt)
    const today = new Date().toISOString().slice(0, 10);
    const ask = (label: string) => {
      const v = prompt(`Informe ${label} (use ponto como separador decimal)`);
      if (!v) return undefined;
      const num = parseFloat(v.replace(",", "."));
      return Number.isFinite(num) ? num : undefined;
    };

    const ureia = ask("Ureia (mg/dL)");
    const creatinina = ask("Creatinina (mg/dL)");
    const leucocitos = ask("Leucócitos (/µL)");

    // 3) Se ao menos um indicador foi informado, atualiza gráfico
    let newExplanation = examExplanation;
    if (ureia !== undefined || creatinina !== undefined || leucocitos !== undefined) {
      const last = examData[examData.length - 1];

      const nextPoint: ExamPoint = {
        date: today,
        ureia: ureia ?? last.ureia,
        creatinina: creatinina ?? last.creatinina,
        leucocitos: leucocitos ?? last.leucocitos,
      };

      setExamData((prev) => [...prev, nextPoint]);

      // Atualiza explicação com base em leucócitos, se informado
      if (leucocitos !== undefined) {
        newExplanation = explainLeucocitos(last.leucocitos, leucocitos);
        setExamExplanation(newExplanation);
      }
    }

    // 4) Adiciona um evento na timeline com botão de download + dados analisados
    const novoEvento: EventItem = {
      date: today,
      event: "Upload de exame",
      details: "Arquivo recebido e valores registrados.",
      fileUrl: url,
      analysis: {
        ureia,
        creatinina,
        leucocitos,
        notas: "Valores informados manualmente no momento do upload.",
      },
    };

    const updated = [...timeline, novoEvento];
    setTimeline(updated);
    await persistTimeline(updated);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold">Histórico Clínico - Mamãe</h1>

      {/* Timeline */}
      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-4">📅 Timeline</h2>
        <div className="space-y-4">
          {timeline.map((item, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <p className="font-bold">
                  {item.date} - {item.event}
                </p>
              </div>

              {/* detalhes */}
              {item.details && (
                <p className="text-sm text-gray-700 ml-6">{item.details}</p>
              )}

              {/* botão de download quando houver arquivo */}
              {item.fileUrl && (
                <div className="ml-6">
                  <a
                    href={item.fileUrl}
                    download
                    className="inline-block text-sm bg-blue-600 text-white px-3 py-1 rounded hover:opacity-90"
                  >
                    Baixar arquivo
                  </a>
                </div>
              )}

              {/* dados analisados */}
              {item.analysis && (
                <div className="ml-6 text-sm text-gray-800">
                  <span className="font-medium">Dados analisados:</span>
                  <ul className="list-disc ml-5">
                    {item.analysis.ureia !== undefined && (
                      <li>Ureia: {item.analysis.ureia}</li>
                    )}
                    {item.analysis.creatinina !== undefined && (
                      <li>Creatinina: {item.analysis.creatinina}</li>
                    )}
                    {item.analysis.leucocitos !== undefined && (
                      <li>Leucócitos: {item.analysis.leucocitos.toLocaleString("pt-BR")}</li>
                    )}
                    {item.analysis.notas && <li>Notas: {item.analysis.notas}</li>}
                  </ul>
                </div>
              )}
              <hr className="border-gray-200 mt-2" />
            </div>
          ))}
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

      {/* Info estática */}
      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-2">🔍 Principais Suspeitas</h2>
        <ul className="list-disc ml-5">
          {suspeitas.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>

      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-2">📝 Resumo do Quadro</h2>
        <p>{resumo}</p>
      </div>

      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-2">⏭ Próximos Passos</h2>
        <ul className="list-disc ml-5">
          {proximosPassos.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </div>

      {/* Formulário */}
      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-2">➕ Adicionar Novo Evento</h2>
        <input
          type="date"
          value={newEvent.date}
          onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
          className="border p-1 rounded mr-2"
        />
        <input
          type="text"
          placeholder="Evento"
          value={newEvent.event}
          onChange={(e) => setNewEvent({ ...newEvent, event: e.target.value })}
          className="border p-1 rounded mr-2"
        />
        <textarea
          placeholder="Detalhes (descreva sintomas, contexto, etc.)"
          value={newEvent.details}
          onChange={(e) =>
            setNewEvent({ ...newEvent, details: e.target.value })
          }
          className="border p-1 rounded w-full mt-2"
        />
        <button
          onClick={handleAddEvent}
          disabled={isSaving}
          className="bg-blue-500 text-white px-3 py-1 rounded mt-2"
        >
          {isSaving ? "Salvando..." : "Adicionar"}
        </button>

        <div className="mt-4">
          <label className="block mb-1 font-medium">
            📎 Upload de Arquivo de Exame
          </label>
          <input type="file" className="border p-1 rounded" onChange={handleFileUpload} />
          <p className="text-xs text-gray-500 mt-1">
            Após o upload, informe os valores do exame. Eles serão registrados na timeline e no gráfico.
          </p>
        </div>
      </div>
    </div>
  );
}
