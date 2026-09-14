VITALCARE MINHA FILA 5.1.1 — PACIENTE
====================================

Esta versão mantém todas as informações exibidas na versão 4.2 e acrescenta melhorias de organização, estética, acessibilidade e acompanhamento em tempo real.

PRINCIPAIS MELHORIAS
- Login somente por CPF + data de nascimento.
- Painel responsivo para celular e desktop.
- Status de conexão e Realtime.
- Relógio explícito no horário de Brasília.
- Contagem regressiva para verificação automática.
- Próximo passo contextual de acordo com a etapa do atendimento.
- Posição e tempo de espera com indicação da fonte da estimativa.
- Sinais vitais completos; glicemia experimental é exibida com aviso quando existir.
- Prontuário clínico organizado por reavaliações, diagnósticos, prescrições, exames, encaminhamentos, procedimentos, evoluções, consentimentos e anexos.
- A seção "Informações úteis" foi preservada e continua exibindo a visão completa dos registros.
- Histórico de atualizações ampliado.
- Solicitação de reavaliação com sugestões rápidas e aviso de segurança.
- Modo de privacidade para ocultar dados sensíveis na tela.
- Impressão de resumo.
- Cópia do número do prontuário.
- Alto contraste, aumento de texto, redução de animações e leitura em voz alta.
- PWA instalável quando o navegador permitir.
- Service Worker v5 com proteção contra cache antigo e sem cache de dados Supabase.
- Fallback de atualização periódica mesmo quando Realtime estiver indisponível.

BANCO DE DADOS
Esta versão utiliza a mesma estrutura/RPCs já configuradas no Supabase para o Minha Fila 4.1/4.2. Não é necessário novo SQL somente para usar a interface 5.0.

TESTE LOCAL
1. Extraia a pasta.
2. Execute INICIAR_MINHA_FILA_5_1.bat.
3. Acesse http://localhost:8012/login.html

SEGURANÇA
- Não contém service_role nem secret key.
- Usa somente a publishable key do Supabase.
- A sessão fica no sessionStorage.
- Dados clínicos do Supabase não são cacheados pelo Service Worker.

Observação: o portal é um protótipo acadêmico e não substitui avaliação clínica presencial.
