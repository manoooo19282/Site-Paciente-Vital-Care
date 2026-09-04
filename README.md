# VitalCare Minha Fila — Portal do Paciente

Site estático responsivo do **VitalCare**, pronto para publicação no **GitHub Pages**.

## O que está incluído

- Visão geral do atendimento da paciente **Catarine**
- Etapa atual e progresso do atendimento
- Estimativa de espera e posição na fila
- Prioridade preliminar
- Linha do tempo completa da jornada
- Sinais vitais
- Resumo da anamnese
- Informações do atendimento
- Histórico de atualizações
- Acessibilidade: leitura em voz alta, aumento de texto, alto contraste e redução de animações
- Layout responsivo para computador, tablet e celular
- Manifesto PWA + service worker para experiência instalável/offline
- Identidade visual própria do VitalCare

## Como alterar os dados da paciente

Abra `data.js`. Todo o conteúdo demonstrativo está centralizado em `window.VITALCARE_DATA`.

Exemplo:

```js
patient: {
  name: "Catarine",
  unit: "Unidade de Atendimento — Campinas"
}
```

Você pode trocar fila, estimativa, prioridade, sinais vitais, anamnese, etapas e atualizações sem modificar `index.html`.

## Como testar localmente

Você pode abrir `index.html` diretamente. Para testar o modo PWA/service worker, rode um servidor local:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub, por exemplo `vitalcare-paciente`.
2. Envie **o conteúdo desta pasta** para a raiz do repositório.
3. No GitHub, abra **Settings → Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha a branch `main` e a pasta `/ (root)`.
6. Salve. O GitHub exibirá o endereço público assim que a publicação terminar.

Não há dependências, npm, build ou servidor backend obrigatório.

## Estrutura

```text
vitalcare-paciente/
├── index.html
├── styles.css
├── data.js
├── script.js
├── manifest.webmanifest
├── sw.js
├── 404.html
├── .nojekyll
├── README.md
└── assets/
    ├── logo-vitalcare.svg
    └── favicon.svg
```

## Observação

Este pacote está configurado como **demonstração acadêmica** do portal do paciente. Para uso real, os dados devem vir de uma API segura, com autenticação, controle de acesso e tratamento adequado de dados de saúde.


## Interface
Esta versão foi desenhada em abordagem **mobile-first**, priorizando uso em celulares, com identidade azul e branca e a logo VitalCare 2.0 Minha Fila no cabeçalho.
