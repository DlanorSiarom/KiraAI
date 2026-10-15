# Kira AI: Orbe Iridescente, Microfone Universal & Deploy Vercel

Plano arquitetural e de design para elevar o Orbe da Kira a uma experiência visual hipnótica com plasma fluido iridescente e reflexo de vidro, implementar captura de voz universal à prova de falhas em qualquer navegador e estruturar o projeto para deploy Serverless na Vercel com paridade total.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisões confirmadas pelo usuário na entrevista interativa:**
> - **Estilo Visual do Orbe**: Orbe de plasma fluido iridescente com efeito vidro e aura holográfica (núcleo luminescente com dispersão cromática, ondas de energia orgânicas e reflexo especular de lente).
> - **Entrada de Microfone**: Modo híbrido com suporte universal. Se a Web Speech API falhar ou não tiver suporte nativo no dispositivo (ex: Safari iOS/macOS ou bloqueio de permissão), ativa gravação direta via `MediaRecorder` enviada ao backend com transcrição rápida via Gemini.
> - **Deploy na Vercel**: Arquitetura híbrida modular com funções Serverless na pasta `/api` (`api/chat.ts`, `api/transcribe.ts`), build estático Vite (`dist/`), arquivo `vercel.json` configurado e preservação do dev server Node.js (`server.ts`) para desenvolvimento local.

---

## 1. Overview & Core Concept

- **O que entrega**: Uma assistente de IA viva (Kira) com presença visual deslumbrante, capaz de ouvir a voz do usuário sem fricção em qualquer navegador (desktop, Android, iOS Safari), responder em voz alta com síntese feminina e ser hospedada gratuitamente e com alta performance na Vercel.
- **Público-alvo**: O usuário e mestres que desejam interagir com a Kira por voz e texto, tanto em ambiente de testes quanto em produção na web pública da Vercel.
- **Valor central**: Eliminar bugs de captura de áudio garantindo escuta real, modernizar a estética do Orbe para uma peça de arte digital interativa e permitir deploy com 1 clique na Vercel sem quebrar rotas de backend ou APIs de IA.

---

## 2. User Experience & Visual Design

### A. Novo Orbe: Plasma Fluido Iridescente & Efeito Vidro
- **Núcleo de Plasma Cromático**: Gradientes orgânicos em movimento com rotação suave em tons de índigo elétrico, ciano puro (`#06B6D4`), violeta profundo (`#8B5CF6`) e toques de turquesa luminoso.
- **Camada de Vidro Refletivo (Fresnel Lens Effect)**: Uma concha esférica com brilho especular curvo translúcido no topo superior esquerdo, transmitindo sensação táctil de cristal líquido ou bolha de vidro energizada.
- **Reatividade Sonora**: Quando o usuário fala, o plasma interno ondula e contrai/expande com física elástica natural sincronizada aos decibéis da voz (`audioLevel`).
- **Estados Visuais Intuitivos**:
  - *Repouso (Idle)*: Respiração calma e fluida com aura azul-violeta sutil; badge minimalista com microfone translúcido.
  - *Escuta (Listening)*: Pulso ciano intenso com halo iridescente aberto e ondas concêntricas de energia que vibram conforme o tom da voz.
  - *Pensamento (Thinking)*: Aceleração da rotação interna do plasma com partículas estelares orbitando em vórtice.
  - *Fala (Speaking)*: Ondulação rítmica ressonante com faixas de luz violeta e azul celeste sincronizadas à cadência da fala da Kira.

### B. Fluxo de Áudio & Microfone À Prova de Falhas
1. **Toque no Orbe**: O usuário clica ou toca no Orbe no centro da tela.
2. **Ativação Imediata**: Se o navegador suportar Web Speech com permissões ativas, inicia escuta com transcrição em tempo real.
3. **Fallback Automático MediaRecorder**: Se a API nativa não estiver disponível ou for bloqueada por políticas de sandbox/iframe, o sistema imediatamente ativa gravação direta do microfone (`audio/webm` ou `audio/mp4`), exibe o cronômetro visual de áudio e, ao soltar ou pausar, envia o áudio ao endpoint `/api/transcribe` com Gemini, transcrevendo em menos de 1 segundo.
4. **Feedback de Permissão Claro**: Caso o usuário negue acesso ao microfone no navegador, um toast com botão para liberar permissões ou continuar por texto é exibido sem travar o aplicativo.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Arquitetura Vercel Serverless + Local Dev Parity**
  - *Abordagem*: Criar manipuladores de API Serverless em `/api/chat.ts` e `/api/transcribe.ts` que funcionam nativamente no runtime Serverless da Vercel (Edge/Node), e reutilizar a mesma lógica no `server.ts` para o ambiente AI Studio e desenvolvimento local.
  - *Por que*: O Vercel não executa processos `server.ts` contínuos em planos padrão; ele executa funções Serverless na pasta `/api/`. Essa estrutura garante que o app funcione idêntico no AI Studio e na Vercel sem alterar uma única linha de código ao subir para o Git.

- **Decisão 2: Captura de Voz Híbrida (WebSpeech + MediaRecorder)**
  - *Abordagem*: Tentativa primária com Web Speech API; caso gere erro ou não exista suporte, aciona gravação de áudio via `MediaRecorder` processada pela API Gemini.
  - *Por que*: Safari no iPhone/iPad e muitos navegadores desktop frequentemente bloqueiam ou não implementam `webkitSpeechRecognition`. O `MediaRecorder` funciona em praticamente 100% dos smartphones e computadores modernos.

- **Decisão 3: Renderizador do Orbe em Canvas 2D Otimizado com Shaders Matemáticos**
  - *Abordagem*: Refatorar `src/components/Orb.tsx` usando um renderizador procedural em Canvas de alta performance com física de plasma senoidal multicamadas, sombras de luz difusa e reflexos de vidro em 60 FPS, sem bibliotecas pesadas adicionais que aumentem o bundle.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          KIRA CLIENT (Vite SPA)                        │
├────────────────────────────────────────────────────────────────────────┤
│  [ Header: Histórico / Memória ]   [ Novo Orbe Iridescente (Canvas) ]  │
│  [ Audio Controller: WebSpeech / MediaRecorder Fallback ]              │
│  [ ResultSheet: Digitação em Tempo Real + Fontes Web + Voz Feminina ]  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP POST
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     BACKEND & SERVERLESS LAYER                         │
├─────────────────────────────────┬──────────────────────────────────────┤
│    Vercel Serverless Routes     │         Local Dev (server.ts)        │
│    - /api/chat.ts               │         - Express dev middleware     │
│    - /api/transcribe.ts         │         - Proxy & hot reload         │
└─────────────────────────────────┴──────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   GEMINI API & EXTERNAL INTEGRATIONS                   │
├────────────────────────────────────────────────────────────────────────┤
│  • Gemini 3.1 Flash Lite / Gemini 3.8 Flash (Raciocínio & JSON estrito)│
│  • Gemini 3.8 Flash Lite TTS (Voz neural feminina Kore)                │
│  • Gemini Transcribe (Transcrição de áudio via MediaRecorder)          │
│  • Google News RSS & Wikipedia (Pesquisa em tempo real)                │
└────────────────────────────────────────────────────────────────────────┘
```

### Arquivos e Estrutura Prevista
1. `vercel.json`: Configuração de build, roteamento de `/api/(.*)` e fallback SPA para `index.html`.
2. `api/chat.ts`: Função Serverless para `/api/chat` compatível com a Vercel.
3. `api/transcribe.ts`: Função Serverless para transcrição de áudio multimodal via Gemini.
4. `server.ts`: Atualizado para sincronizar os mesmos endpoints em ambiente de desenvolvimento local.
5. `src/components/Orb.tsx`: Novo design procedural de plasma iridescente, reflexos de vidro e aura holográfica.
6. `src/services/audioRecorder.ts`: Módulo de captura de microfone universal com MediaRecorder e detecção de silêncio.
7. `src/App.tsx`: Integração da captura híbrida, clique no Orbe sem falhas e sincronização com a resposta falada da Kira.
