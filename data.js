// Dados demonstrativos do portal VitalCare.
// Edite apenas este objeto para trocar o paciente e o estado do atendimento.
window.VITALCARE_DATA = {
  patient: {
    name: "Catarine",
    unit: "Unidade de Atendimento — Campinas",
    visitId: "VC-DEMO-2026",
    arrivalTime: "08:31"
  },
  status: {
    label: "Em espera",
    currentStage: "Aguardando avaliação médica",
    message: "Seu pré-atendimento foi concluído e seus dados já estão disponíveis para a equipe.",
    progress: 60,
    waitMinutes: 22,
    queuePosition: 4,
    peopleAhead: 3,
    priority: "Amarela",
    precheckTime: "08:47",
    vitalsTime: "08:46"
  },
  vitals: [
    { label: "Pressão arterial", value: "118/76", unit: "mmHg", note: "Última aferição", icon: "↕", tone: "blue" },
    { label: "Frequência cardíaca", value: "92", unit: "bpm", note: "Pulso registrado", icon: "♥", tone: "rose" },
    { label: "Saturação de oxigênio", value: "98", unit: "%", note: "SpO₂", icon: "◉", tone: "teal" },
    { label: "Temperatura", value: "37,4", unit: "°C", note: "Temperatura corporal", icon: "⌁", tone: "amber" }
  ],
  anamnesis: [
    { label: "Queixa principal", value: "Dor de cabeça e mal-estar" },
    { label: "Início dos sintomas", value: "Há aproximadamente 3 horas" },
    { label: "Intensidade informada", value: "5 de 10" },
    { label: "Alergias", value: "Nenhuma alergia informada" },
    { label: "Medicamentos em uso", value: "Nenhum informado" },
    { label: "Condições preexistentes", value: "Nenhuma informada" }
  ],
  attendanceInfo: [
    { label: "Unidade", value: "Unidade de Atendimento — Campinas" },
    { label: "Chegada", value: "08:31" },
    { label: "Pré-atendimento concluído", value: "08:47" },
    { label: "Próxima etapa", value: "Avaliação médica" },
    { label: "Acompanhamento", value: "Portal VitalCare ativo" }
  ],
  journey: [
    { title: "Chegada à unidade", description: "Entrada registrada no atendimento.", time: "08:31", state: "done" },
    { title: "Cadastro", description: "Identificação e dados iniciais confirmados.", time: "08:34", state: "done" },
    { title: "Anamnese", description: "Sintomas e informações de saúde registrados.", time: "08:39", state: "done" },
    { title: "Sinais vitais", description: "Pressão, frequência cardíaca, SpO₂ e temperatura aferidos.", time: "08:46", state: "done" },
    { title: "Aguardando avaliação médica", description: "Você está nesta etapa agora.", time: "Agora", state: "current" },
    { title: "Conduta e próximos passos", description: "Aparecerá aqui quando houver atualização.", time: "—", state: "upcoming" }
  ],
  updates: [
    { time: "08:48", title: "Fila atualizada", text: "Sua estimativa atual de espera é de aproximadamente 22 minutos.", type: "info" },
    { time: "08:47", title: "Pré-atendimento concluído", text: "Seu prontuário inicial foi organizado e encaminhado ao fluxo de atendimento.", type: "success" },
    { time: "08:46", title: "Sinais vitais registrados", text: "As últimas aferições já estão disponíveis no portal.", type: "success" },
    { time: "08:39", title: "Anamnese concluída", text: "As informações que você respondeu foram salvas.", type: "success" }
  ]
};
