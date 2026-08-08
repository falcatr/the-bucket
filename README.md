# ASCII Ocean Mobile v0.2.10

Simplificação da extensão superior do oceano.

## Removido

Foram retirados completamente:

- a faixa de cidade/topo;
- os blocos de skyline;
- luzes da cidade;
- o divisor `========T========`.

A área superior volta a ser dedicada somente à leitura da água.

## Área revelada no pull

Num pull profundo:

```text
    ==     _
  ____  ==
     ===
 ·      __
   ~~~
==      ___

~~~~ superfície ~~~~
oceano
```

Os reflexos ocupam agora praticamente toda a extensão escondida do
mesmo canvas.

Como o espaço antes reservado à cidade ficou livre, a quantidade de
grupos de reflexo foi aumentada levemente para que a parte superior
continue interessante mesmo em um pull de aproximadamente 50%.

## Separador que permanece

O único divisor visual é a superfície orgânica do próprio oceano:

```text
~ = _ ~ ~ = _
```

Ela continua:

- escondida em repouso;
- entrando na viewport durante o pull;
- servindo como referência visual para o balde sair da água;
- animada pelo mesmo `Intensidade de animação`.

## Threshold

Sem alterações nesta release:

```text
Distância para atualizar
4 → 30 cel

default: 25 cel
```

O threshold continua sendo calculado pela distância VISUAL do canvas.

## Defaults

- Distância vertical: `1 cel`
- Distância horizontal: `1 cel`
- Altura máxima dos corais: `30%`
- Altura máxima das algas: `60%`
- Intensidade de animação: `150%`
- Distância para atualizar: `25 cel`
- Tamanho do balde: `1x`

## Rodando

```bash
npm run dev
```

Build:

```bash
npm run build
npm run preview
```
