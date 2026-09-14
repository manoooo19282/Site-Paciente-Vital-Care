# VitalCare Minha Fila 5.1.3 — alterações

## Interface e experiência
- Nova organização responsiva para celular e desktop sem retirar nenhum dado já exibido na 4.2.
- Barra de conexão, horário de Brasília, sincronização e próxima verificação.
- Cabeçalho com unidade e número de prontuário.
- Cartão contextual **O que acontece agora?**.
- Resumo de fila, prioridade, espera e pré-atendimento aprimorado.
- Nova central de prontuário por categorias, mantendo também a visão completa em **Informações úteis**.
- Histórico ampliado e melhor leitura de eventos.
- Modo de privacidade para ocultar dados sensíveis em tela.
- Impressão de resumo e cópia do número do prontuário.
- PWA instalável quando suportado.

## Dados clínicos exibidos
- Cadastro completo do paciente.
- Atendimento, unidade, setor, sala e timestamps.
- Anamnese completa.
- Sinais vitais e qualidade da aferição.
- Glicemia experimental com indicação explícita quando existente.
- Classificação, pontuação, componentes, inconsistências, combinações e gatilhos.
- Reavaliações e solicitações do paciente.
- Diagnósticos, prescrições, exames, encaminhamentos, procedimentos, evoluções, consentimentos e anexos.
- Eventos e histórico do atendimento.

## Atualização
- Supabase Realtime para as tabelas publicadas.
- Redundância de consulta a cada 20 segundos.
- Atualização ao voltar para a aba, reconectar ou clicar em atualizar.
- Aviso acessível quando a etapa do atendimento muda.

## Reavaliação
- Botão preservado e aprimorado.
- Sugestões rápidas de motivo.
- Contador de caracteres.
- Alerta para procurar a equipe presencialmente em piora importante.
- Sem permitir que o paciente altere a própria classificação.

## Segurança do frontend
- Apenas publishable key.
- Sessão em sessionStorage.
- Sem cache de respostas do Supabase.
- Service Worker 5.0 com network-first para HTML/JS/CSS para evitar versões antigas.
- Modo de privacidade visual opcional.

## Acessibilidade
- Pular para conteúdo.
- Região aria-live para mudanças de atendimento.
- Alto contraste.
- Aumento de texto.
- Redução de movimento.
- Leitura em voz alta.
- Navegação por teclado e foco nativo preservados.
