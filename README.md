# ASCII Ocean Mobile v0.3.1

Patch de calibração sobre a v0.3.0. Nenhuma mecânica foi alterada.

## Novos defaults

- Altura máxima dos corais: `35%`
- Velocidade de esvaziamento: `12x`
- Elasticidade do balde: `1.6 cel`

Todo o restante permanece igual à v0.3.0.

---

Início da série `0.3.x`, focada em consolidar o ciclo do refresh e
preparar a interação para continuar crescendo sem encarecer o renderer
em aparelhos mobile mais antigos.

## Nova seed no release

A nova combinação procedural de:

- corais;
- algas;
- peixes;
- vida do recife;
- reflexos superiores;

agora é criada no momento em que o usuário SOLTA um pull aceito.

O esvaziamento do balde deixa de controlar quando o conteúdo muda.
Ele é somente o fake loading visual.

Fluxo:

```text
pull válido
    ↓
release
    ↓
NOVA SEED IMEDIATAMENTE
    ↓
IDLE-SWIPE continua visível
    ↓
balde esvazia sobre o mar novo
    ↓
canvas volta ao repouso
    ↓
IDLE-LOADING
```

## Requisito de pelo menos uma faixa branca

Um pull só entra no ciclo de refresh se duas condições forem verdadeiras:

1. a linha `,--[___]--,` já saiu da água;
2. existe pelo menos uma faixa 100% completa/branca.

Se o usuário puxar cedo demais, mesmo ultrapassando a superfície:

- nenhuma nova seed é criada;
- não entra em IDLE-SWIPE;
- o canvas simplesmente retorna;
- o loading em andamento continua de onde estava.

Se há uma faixa branca e outra amarela parcial:

- a nova seed acontece no release;
- a faixa amarela é descartada;
- somente as faixas brancas são carregadas para o IDLE-SWIPE.

## Velocidade de esvaziamento

O range foi ampliado para:

```text
0.5x → 16x
```

O valor salvo anteriormente continua sendo preservado no
`localStorage`, portanto esta versão não força um novo default.

## Implementação de velocidade / performance

A velocidade não cria mais trabalho conforme aumenta.

Não existe:

- um timer por célula;
- `setInterval` para cada barra;
- partículas extras em velocidades altas;
- mais updates quando o slider vai para 16x.

Existe apenas:

```text
requestAnimationFrame
       +
1 relógio drainElapsedMs
       +
cálculo matemático do estado de cada slot
```

O balde possui no máximo 39 slots de loading (`3 × 13`), então cada
frame continua avaliando a mesma quantidade fixa de posições.

`16x` simplesmente reduz:

```js
drainSlotDurationMs =
  bucketLoadingSlotDurationMs /
  bucketDrainSpeedMultiplier
```

Se um aparelho perder frames, o estado é derivado do tempo decorrido.
A animação pode pular um estágio visual intermediário, mas não fica
mais lenta e não acumula callbacks atrasados.

## Otimização adicional

A ordem das linhas que precisam ser esvaziadas é calculada uma única
vez no release e reutilizada durante todo o drain.

Também foi removida a criação de pequenos objetos/arrays para cada
slot em cada frame.

Assim, aumentar de `4x` para `16x` não aumenta o custo computacional
do ciclo.

## Comportamentos preservados

- pull responsivo baseado na geometria balde ↔ superfície;
- balde só troca para `IDLE-SWIPE` no release;
- aproximadamente 20% da parte superior permanece visível durante
  o fake loading;
- efeito elástico do balde continua configurável;
- estrutura do balde e faixas concluídas usam branco puro;
- intensidade geral do mar permanece fixa em `150%`;
- tamanho do balde permanece fixo em `1x`.

## Debug atual

- Distância vertical do coral
- Distância horizontal do coral
- Altura máxima dos corais
- Altura máxima das algas
- Velocidade de esvaziamento (`0.5x–16x`)
- Elasticidade do balde

## Rodando

```bash
npm run dev
```

Build:

```bash
npm run build
npm run preview
```
