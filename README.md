# ASCII Ocean Mobile v0.4.2

Patch de tooling para facilitar testes da mecânica de Gacha / Nervous Systems.

## Debug reduzido

Os valores abaixo continuam em `game-config.json`, mas não aparecem mais no painel:

- `coralVerticalSpacing: 1`
- `coralHorizontalSpacing: 1`
- `coralHeight: 35`
- `algaeHeight: 60`
- `bucketBounceCells: 1.6`

O debug visual agora fica focado em:

- Tamanho do balde
- Velocidade de enchimento
- Velocidade de esvaziamento
- Attention por célula
- Multiplicador de Apetite
- Chance JOY
- Chance RAGE
- Chance FEAR
- Chance GRIEF
- Duração célula especial
- Decaimento nervous buffer

## Velocidade de enchimento

Novo valor:

```json
"bucketFillSpeedMultiplier": 1
```

No debug:

```text
Velocidade de enchimento
0.25x → 20x
```

O baseline histórico `bucketLoadingSlotDurationMs: 1000` continua no JSON. A duração efetiva é:

```text
1000 ms / bucketFillSpeedMultiplier
```

Assim `2x` enche duas vezes mais rápido, `10x` dez vezes mais rápido etc. Não são criados timers adicionais.

## Decaimento mais preciso

`nervousBufferDecayPerSecond` agora usa:

```text
step = 0.001
inputmode = decimal
```

Portanto valores como:

```text
0.1
0.05
0.02
0.005
```

podem ser digitados diretamente no debug (inclusive em teclado mobile com suporte a decimal).

## Botões de Nervous Buffer

O rodapé do debug ganhou:

```text
BUFFER +1
ZERAR BUFFER
```

`BUFFER +1` adiciona 1 ponto ao polo que está atualmente sendo exibido. Se chegar a 10, usa a mesma regra real: contabiliza 1 ponto daquela emoção e zera aquele eixo.

Se não houver nenhum eixo ativo, o botão não cria uma emoção artificial.

`ZERAR BUFFER` zera apenas o eixo atualmente exibido. Caso o outro eixo possua valor acumulado, ele passa automaticamente a ser o buffer visível.

Esses botões são ferramentas de teste e não fazem parte da interação do jogador.

## Fonte de verdade

O `game-config.json` continua sendo a fonte de verdade ao iniciar/recarregar a aplicação. Valores ocultos do debug permanecem totalmente configuráveis por esse arquivo.

## Defaults relevantes

```json
{
  "bucketLoadingRows": 1,
  "bucketFillSpeedMultiplier": 1,
  "bucketDrainSpeedMultiplier": 7,
  "attentionValuePerCell": 1,
  "appetiteMultiplier": 50,
  "specialCellDrainDurationMultiplier": 6,
  "nervousBufferDecayPerSecond": 0.1
}
```

## Rodando

```bash
npm run dev
```

Build:

```bash
npm run build
npm run preview
```
