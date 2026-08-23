# ASCII Ocean Mobile v0.4.19

Pequeno ajuste de progressão em duas frentes:

1. velocidade de enchimento aumenta conforme o tamanho do balde;
2. o aprendizado do gacha por emoção fica mais perceptível.

## Progressão da velocidade de enchimento

A velocidade agora é resolvida automaticamente pelo tamanho atual do balde:

```text
balde 1-3  -> 1.8x
balde 4-6  -> 2.2x
balde 7-9  -> 2.5x
balde 10   -> 3.0x
```

Novas chaves no `game-config.json`:

```json
"bucketFillSpeedMultiplier": 1.8,
"bucketFillSpeedAtRows4Multiplier": 2.2,
"bucketFillSpeedAtRows7Multiplier": 2.5,
"bucketFillSpeedAtRows10Multiplier": 3.0
```

O controle existente do debug foi renomeado para deixar claro que ele representa
somente o tier inicial:

```text
Velocidade enchimento (balde 1-3)
```

Os tiers 4, 7 e 10 continuam configuráveis diretamente pelo JSON.

## Gacha adaptativo mais perceptível

O boost da mesma emoção foi aumentado de:

```text
1.00 -> 1.35
```

por score efetivo.

Configuração:

```json
"gachaAdaptiveOwnBoostPctPerScore": 1.35,
"gachaAdaptiveOppositeBoostPctPerScore": 0.35,
"gachaAdaptiveSaturationScore": 12,
"gachaAdaptiveEmotionChanceCapPct": 30
```

### Por que isso não canibaliza diretamente as outras células especiais

O sistema continua trabalhando com **porcentagens absolutas aditivas**.

Completar Rage, por exemplo:

- aumenta mais claramente a chance futura de Rage;
- o pequeno reforço existente de Fear continua igual;
- Joy e Grief mantêm suas chances-base;
- nenhuma chance especial é subtraída diretamente para pagar o boost de Rage.

O cap individual continua em 30%, e os diminishing returns continuam ativos por
meio de `gachaAdaptiveSaturationScore = 12`, evitando crescimento explosivo.

## Rodando

```bash
npm run dev
npm run build
npm run preview
```
