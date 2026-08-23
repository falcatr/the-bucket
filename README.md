# ASCII Ocean Mobile v0.4.18

Revisão de fidelidade da **criatura 2 / família beta**.

## O problema que ainda restava

A fórmula já estava correta na v0.4.17, mas o renderer ainda não reproduzia duas
características fundamentais do sketch de referência.

### 1. Agora são usados os 10.000 pontos discretos

O original executa:

```js
for(t+=PI/240,i=1e4;i--;) a(i/295)
```

A beta agora usa os mesmos **10.000 índices**, na mesma direção `9999 -> 0`, em
vez de reduzir a estrutura a 900 amostras.

### 2. Agora o canvas 400x400 é tratado como um viewport fixo

A função possui `cos(y)/k`. Quando `k` fica muito próximo de zero, alguns pontos
matemáticos ficam muito distantes.

No p5 original esses pontos simplesmente saem do canvas de 400x400 e são
**recortados**.

Antes, o jogo colocava esses outliers no bounding box e diminuía toda a criatura
para fazê-los caber. Isso era o principal motivo para a estrutura ficar pequena
e indistinguível.

Agora a beta usa exatamente o viewport lógico da referência:

```text
X local: -200 .. 200  (equivale ao +200 do código original)
Y:        0 .. 400
```

O restante é naturalmente clipped pelo Canvas2D.

## Fórmula

A implementação continua baseada diretamente em:

```js
a=(y,d=mag(k=(5+sin(y*2-t/2)*2)*cos(i/29),e=y/7-13)-6)=>point((q=3*sin(k*2)+cos(y)/k+sin(y/25)*k*(9+4*sin(e*9-d*3+t*2)))+50*cos(c=d-t)+200,q*sin(c)+d*39)
t=0,draw=$=>{t||createCanvas(w=400,w);background(9).stroke(w,116);for(t+=PI/240,i=1e4;i--;)a(i/295)}//
```

A única tradução retirada é o `+200` global em X, pois o sprite local já possui
seu próprio centro.

## Stroke da referência

A beta agora usa alpha equivalente a:

```text
116 / 255
```

como no `stroke(w,116)` original.

## Escala

Não há mais alongamento artificial horizontal ou vertical. A forma mantém
aspect ratio 1:1 e recebe apenas um aumento uniforme moderado:

```json
"aquariumCreatureBetaPointSamples": 10000,
"aquariumCreatureBetaScaleMultiplier": 1.28,
"aquariumCreatureBetaWidthMultiplier": 1.0,
"aquariumCreatureBetaHeightMultiplier": 1.0,
"aquariumCreatureBetaSpriteFill": 1.0,
"aquariumCreatureBetaPointSizeMultiplier": 1.0
```

## Sobre o comentário dos 10.000 pontos

Para reproduzir este sketch, a observação útil é que a geometria resulta da
avaliação determinística das funções trigonométricas nos 10.000 pontos
 discretos. Essa densidade realmente importa visualmente.

As afirmações biofísicas adicionais do comentário não são necessárias para a
implementação e não foram usadas como premissas técnicas.

## Onboarding

A correção que rearma o `swipe` para o segundo enchimento foi preservada.

## Rodando

```bash
npm run dev
npm run build
npm run preview
```
