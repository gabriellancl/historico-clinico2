"use client";
import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

export default function App() {
  const [timeline, setTimeline] = useState([]);
  const [examData, setExamData] = useState([
    { date: "2025-08-12", ureia: 60, creatinina: 1.6, leucocitos: 13800 },
  ]);
  const [examExplanation, setExamExplanation] = useState(
    "Hemograma: leucócitos elevados (13.800/µL) → indica resposta inflamatória."
  );
  const [suspeitas, setSuspeitas] = useState([
    "Reação adversa à Macrodantina",
    "Desidratação",
    "Infecção urinária",
  ]);
  const [resumo, setResumo] = useState(
    "Paciente apresentou vômitos, desidratação e sinais vitais instáveis. Internada para hidratação e investigação."
  );
  const [proximosPassos, setProximosPassos] = useState([
    "Aguardar resultado da cultura de urina",
    "Reavaliar necessidade de tomografia",
    "Manter hidratação",
  ]);
  const [newEvent, setNewEvent] = useState({ date: "", event: "", details: "" });
  const [isSaving, setIsSaving] = useState(false);

  // Carregar timeline salva no backend (Blob)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/events");
        if (res.ok) {
          const data = await res.json();
          setTimeline(data);
        } else {
          setTimeline([
            { date: "2025-08-12", event: "Internação por desidratação", details: "Pressão baixa, taquicardia, vômitos" },
          ]);
        }
      } catch {
        setTimeline([
          { date: "2025-08-12", event: "Internação por desidratação", details: "Pressão baixa, taquicardia, vômitos" },
        ]);
      }
    })();
  }, []);

  const handleAddEvent = async () => {
    if (!newEvent.date || !newEvent.event) return;
    const updated = [...timeline, newEvent];
    setIsSaving(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setTimeline(updated);
        setNewEvent({ date: "", event: "", details: "" });
      } else {
        alert("Não foi possível salvar agora. Tente novamente.");
      }
    } catch {
      alert("Erro de rede ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) {
      alert("Falha no upload");
      return;
    }
    const { url } = await res.json();

    setExamData((prev) => [
      ...prev,
      { date: "2025-08-13", ureia: 58, creatinina: 1.4, leucocitos: 12000 },
    ]);
    setExamExplanation(
      "Hemograma: leucócitos ainda elevados (12.000/µL), porém em queda → possível melhora."
    );

    const novoEvento = {
      date: new Date().toISOString().slice(0, 10),
      event: "Upload de exame",
      details: `Arquivo salvo: ${url}`,
    };
    const updated = [...timeline, novoEvento];
    setTimeline(updated);

    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold">Histórico Clínico - Mamãe</h1>

      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-4">📅 Timeline</h2>
        <div className="space-y-4">
          {timeline.map((item, index) => (
            <div key={index} className="flex items-center space-x-4">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <div>
                <p className="font-bold">
                  {item.date} - {item.event}
                </p>
                <p className="text-sm text-gray-600">{item.details}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

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

      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-2">🔍 Principais Suspeitas</h2>
        <ul className="list-disc ml-5">
          {suspeitas.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>

      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-2">📝 Resumo do Quadro</h2>
        <p>{resumo}</p>
      </div>

      <div className="bg-white shadow p-4 rounded-2xl">
        <h2 className="text-xl font-semibold mb-2">⏭ Próximos Passos</h2>
        <ul className="list-disc ml-5">
          {proximosPassos.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </div>

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
          onChange={(e) => setNewEvent({ ...newEvent, details: e.target.value })}
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
          <label className="block mb-1 font-medium">📎 Upload de Arquivo de Exame</label>
          <input type="file" className="border p-1 rounded" onChange={handleFileUpload} />
        </div>
      </div>
    </div>
  );
}
