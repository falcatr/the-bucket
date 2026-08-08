# ASCII Ocean Mobile v0.2.4

Baseline final desta etapa 0.2.x antes das próximas mecânicas.

## Defaults adotados

O menu de debug agora inicia com:

- Distância vertical: `1 cel`
- Distância horizontal: `1 cel`
- Altura máxima dos corais: `30%`
- Altura máxima das algas: `60%`
- Intensidade de animação: `150%`
- Distância para atualizar: `6 cel`
- Tamanho do balde: `1.00x`

A chave de configuração do `localStorage` foi versionada novamente nesta release para que os novos defaults apareçam mesmo em browsers usados para testar as versões anteriores.

## Alturas independentes

`coralHeight` e `algaeHeight` agora são parâmetros separados.

A altura máxima define o limite vertical permitido para cada família, mas cada formação continua sorteando sua própria altura dentro desse espaço. Portanto `60%` para algas não significa que todas chegarão a 60% da tela.

## Rebalanceamento de coral e alga

A v0.2.3 reduziu demais a presença das algas. Nesta versão:

- a quantidade de algas foi aumentada novamente;
- continuam existindo algas baixas, médias e algumas altas;
- algas altas continuam menos comuns;
- o coral mantém as quatro famílias procedurais (`pillar`, `mound`, `fan`, `shelf`);
- o coral continua sendo a estrutura principal do fundo, mas há mais vegetação distribuída entre as formações.

## Menos animação no coral

Os `reefMutations` continuam existindo porque ajudam a reproduzir a referência, mas ficaram mais discretos:

- menos pontos animados;
- troca de glifo mais lenta;
- brilho menor;
- deslocamento/twitch menor;
- resposta mais suave ao slider de intensidade.

O movimento mais perceptível na área do recife continua vindo dos `reefCrawlers`, que atravessam horizontalmente o fundo.

## Pull-to-refresh e balde

Sem mudanças funcionais nesta release:

- pull de cima para baixo;
- abaixo do threshold: volta sem refresh;
- acima do threshold: refresh apenas ao soltar;
- balde troca de estado somente no release válido;
- nova seed apenas pelo pull válido ou por `NOVA VARIAÇÃO` no debug;
- loading do balde continua com `1000 ms` por segmento individual.

## Rodando

```bash
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

O app continua mobile-first em portrait, mas também funciona em browsers desktop modernos.
