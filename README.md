# ASCII Ocean Mobile v0.3.5

Primeira implementação da mecânica de pontuação **Attention**.

## Regra de Attention

Cada slot branco de uma linha COMPLETA possui um valor inteiro:

```text
Attention por célula
```

Default:

```text
1 ponto
```

O valor é configurável por input numérico no debug.

Range atual:

```text
1 → 9999 pts por célula
```

## Quando o ponto é ganho

O ponto não é recebido no release e não é recebido apenas por existir
dentro do balde.

Ele é recebido exatamente quando o slot termina seu esvaziamento:

```text
█ → ▓ → ▒ → ░ → ≡
                 ↑
          Attention aqui
```

Cada slot só pode pontuar uma vez.

Exemplo com duas linhas completas:

```text
26 slots × 1 ponto = 26 Attention
```

Se o usuário deixar apenas 18 slots terminarem o drain:

```text
Attention ganho = 18
```

## Double tap = descarte da pontuação restante

O comportamento de descarte da v0.3.4 agora está conectado à lógica de
Attention.

Se:

- 18 slots já foram drenados;
- 8 slots ainda continuam no balde;
- o usuário faz double tap;

então:

```text
18 slots → já contabilizados
 8 slots → X amarelo / descartados
 8 slots → ZERO Attention
```

Pontuação já ganha nunca é removida.

Apenas aquilo que ainda estava fisicamente no balde deixa de ser
contabilizado.

## Separação entre lógica e visual

A pontuação não pertence ao `BucketLayer` nem ao HUD.

Nova estrutura:

```text
src/
├─ game/
│  └─ AttentionSystem.js
└─ ui/
   └─ HudLayer.js
```

`AttentionSystem` é responsável por:

- total de Attention;
- valor configurável por célula;
- quantidade de células drenadas;
- quantidade de slots descartados.

O balde apenas comunica eventos:

```text
célula terminou drain
slot foi descartado
```

O HUD apenas apresenta o resultado.

Isso prepara a pontuação para ser usada por outras mecânicas sem
acoplá-la à interface.

## HUD inferior

Inspirado na barra inferior do vídeo de referência, foi adicionada uma
nova layer fixa:

```text
HUD Layer
```

Ela fica acima de:

- oceano;
- balde.

E não acompanha o movimento do pull.

Visual:

```text
┌────────────────────────────────────┐
│ ATTENTION 0000   APETITE 0000     │
└────────────────────────────────────┘
```

A faixa usa um ciano diferente do background do mar.

Assim como na referência:

- os nomes ficam dentro de blocos pretos;
- o texto dos nomes usa ciano;
- os números ficam pretos sobre a faixa;
- `ATTENTION` é atualizado;
- `APETITE` já reserva seu espaço, mas permanece `0000` nesta versão.

O contador usa no mínimo quatro dígitos:

```text
0000
0001
0048
9999
10000
```

Ele não é limitado a quatro dígitos.

## Feedback visual por célula

Quando um slot termina de esvaziar, pequenos fragmentos amarelos saem
da posição real daquela célula e viajam em direção ao contador de
Attention.

O contador também recebe um pequeno pulse a cada incremento.

Essa animação está na HUD Layer, então os fragmentos podem passar por
cima do oceano e do balde sem serem afetados pelo swipe.

## Performance

O sistema de pontuação foi feito para não alterar a frequência do
drain.

Para detectar pontuação existe apenas:

```text
drainElapsedMs
  ↓
quantidade de slots que já chegaram a 100%
  ↓
comparar com creditedDrainSlots
```

Portanto, se um frame pular por performance, todas as células que
deveriam ter terminado naquele intervalo são contabilizadas uma única
vez no próximo frame.

Não existem timers por célula.

Os fragmentos visuais:

- usam o mesmo requestAnimationFrame da HUD;
- são limitados a no máximo 84 elementos;
- cada célula gera apenas 3 fragmentos;
- não criam DOM;
- usam apenas texto Canvas 2D e interpolação matemática simples.

O double tap continua sem gerar Attention para os slots presentes na
máscara de descarte.

## Configuração nova

Debug:

```text
Attention por célula
default: 1 pts
```

Os demais defaults permanecem:

- Tamanho do balde: `3 linhas`
- Velocidade de esvaziamento: `12x`
- Elasticidade: `1.6 cel`
- Altura máxima dos corais: `35%`

## Roadmap

Mantido:

a velocidade de esvaziamento futuramente poderá depender da quantidade
de linhas completas no release.

A lógica de Attention já trabalha em nível de slot, então essa futura
mudança de velocidade não altera a contabilização.

## Rodando

```bash
npm run dev
```

Build:

```bash
npm run build
npm run preview
```
