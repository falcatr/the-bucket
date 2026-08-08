# ASCII Ocean Mobile v0.2.11

Refatoração do critério de pull-to-refresh para funcionar de forma
consistente entre diferentes resoluções e aspect ratios.

## Removido: Distância para atualizar

O slider por células foi removido.

Mesmo quando a distância era calculada visualmente, um número fixo
ainda precisava ser recalibrado entre desktop, Device Mode e aparelhos
físicos.

## Nova condição

O refresh agora depende da geometria da cena.

A referência no balde é:

```text
  ,--[___]--,
```

Essa é a linha `IDLE_LOADING_ART[1]`.

O gesto só fica armado quando a superfície animada da água passa
totalmente para baixo dessa linha.

```text
NÃO ARMADO

~~~~~ superfície ~~~~~
      ___
  ,--[___]--,
 /            \


ARMADO

      ___
  ,--[___]--,  ← borda superior inteira fora da água

~~~~~ superfície ~~~~~
 /            \
```

A troca para `IDLE-SWIPE` continua acontecendo somente no release.

## Como é calculado

Em cada movimento são comparados em coordenadas reais da tela:

- Y atual da linha de superfície;
- Y da borda inferior da linha `,--[___]--,`.

O cálculo já leva em conta:

- resolução;
- aspect ratio;
- largura lógica da grade;
- `cellH` real;
- `bucketScale`;
- posição vertical do balde;
- tamanho da arte;
- extensão superior escondida;
- deslocamento atual do canvas.

Portanto mudar o balde de `1x` para outro tamanho também recalibra
automaticamente o ponto de refresh.

## Margem de segurança

Existe apenas uma pequena margem interna:

```js
REFRESH_CLEARANCE_CELLS = 0.08;
```

Ela evita considerar refresh exatamente no pixel em que a superfície
e a borda do balde se tocam.

Isso não é um threshold por device; é apenas uma tolerância geométrica.

## Debug atual

Permanecem:

- Distância vertical do coral
- Distância horizontal do coral
- Altura máxima dos corais
- Altura máxima das algas
- Intensidade de animação
- Tamanho do balde

`Distância para atualizar` não existe mais.

## Demais comportamentos

Mantidos:

- pull visual de até aproximadamente 50% da viewport;
- reflexos em cascata acima da superfície;
- superfície fora da tela em repouso;
- balde fixo durante o pull;
- refresh apenas no release;
- balde `1x` como default;
- intensidade `150%` como default.

## Rodando

```bash
npm run dev
```

Build:

```bash
npm run build
npm run preview
```
