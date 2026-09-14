# VitalCare Minha Fila 5.1.3

Portal do paciente integrado ao Supabase do VitalCare.

## Acesso
CPF + data de nascimento. O banco vincula a sessão anônima autenticada ao atendimento autorizado.

## Atualização
- Supabase Realtime quando disponível.
- Verificação periódica a cada 20 segundos como redundância.
- Atualização ao voltar para a aba, reconectar a internet ou usar **Atualizar agora**.
- Horários exibidos em `America/Sao_Paulo`.

## Dados exibidos
Nenhuma informação da versão 4.2 foi removida. O portal exibe cadastro, atendimento, anamnese, sinais vitais, classificação, fila, posição, estimativa, reavaliações, solicitações de reavaliação, diagnósticos, prescrições, exames, encaminhamentos, procedimentos, evoluções, consentimentos, anexos e histórico de eventos.

## Segurança do frontend
A aplicação usa a publishable key do Supabase e depende de RLS/RPCs para autorização. Não inclua `service_role` ou secret keys neste projeto.

## Executar localmente
Execute `INICIAR_MINHA_FILA_5_1.bat` ou rode `py -m http.server 8012` e abra `http://localhost:8012/login.html`.
