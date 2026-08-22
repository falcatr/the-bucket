export const BUCKET_CELL_TYPES =
  Object.freeze({
    ATTENTION: 0,
    JOY: 1,
    RAGE: 2,
    FEAR: 3,
    GRIEF: 4
  });

const CELL_META =
  Object.freeze({
    [BUCKET_CELL_TYPES.ATTENTION]:
      Object.freeze({
        id: "attention",
        label: "attention",
        color: "#ffffff",
        glowColor: null
      }),
    [BUCKET_CELL_TYPES.JOY]:
      Object.freeze({
        id: "joy",
        label: "joy",
        color: "#fff35d",
        glowColor:
          "rgba(255, 243, 93, 0.95)"
      }),
    [BUCKET_CELL_TYPES.RAGE]:
      Object.freeze({
        id: "rage",
        label: "rage",
        color: "#ff3b52",
        glowColor:
          "rgba(255, 59, 82, 0.95)"
      }),
    [BUCKET_CELL_TYPES.FEAR]:
      Object.freeze({
        id: "fear",
        label: "fear",
        color: "#4cff79",
        glowColor:
          "rgba(76, 255, 121, 0.95)"
      }),
    [BUCKET_CELL_TYPES.GRIEF]:
      Object.freeze({
        id: "grief",
        label: "grief",
        color: "#4798ff",
        glowColor:
          "rgba(71, 152, 255, 0.95)"
      })
  });

export function getBucketCellMeta(
  type
) {
  return (
    CELL_META[type] ??
    CELL_META[
      BUCKET_CELL_TYPES.ATTENTION
    ]
  );
}

export function isSpecialBucketCell(
  type
) {
  return (
    type !==
    BUCKET_CELL_TYPES.ATTENTION
  );
}

export class GachaSystem {
  constructor(
    config,
    {
      chanceResolver
    } = {}
  ) {
    this.config = config;

    // Future hook:
    // contextual systems can replace/modify the fixed chances without
    // changing BucketLayer or the roll algorithm.
    this.chanceResolver =
      chanceResolver;
  }

  getBaseChances() {
    return {
      joy:
        Math.max(
          0,
          Number(
            this.config
              .gachaJoyChancePct
          ) || 0
        ),
      rage:
        Math.max(
          0,
          Number(
            this.config
              .gachaRageChancePct
          ) || 0
        ),
      fear:
        Math.max(
          0,
          Number(
            this.config
              .gachaFearChancePct
          ) || 0
        ),
      grief:
        Math.max(
          0,
          Number(
            this.config
              .gachaGriefChancePct
          ) || 0
        )
    };
  }

  getEffectiveChances(
    context = {}
  ) {
    const base =
      this.getBaseChances();

    const resolved =
      this.chanceResolver?.(
        {
          base: {
            ...base
          },
          context,
          config:
            this.config
        }
      ) ?? base;

    const raw = {
      joy:
        Math.max(
          0,
          Number(
            resolved.joy
          ) || 0
        ),
      rage:
        Math.max(
          0,
          Number(
            resolved.rage
          ) || 0
        ),
      fear:
        Math.max(
          0,
          Number(
            resolved.fear
          ) || 0
        ),
      grief:
        Math.max(
          0,
          Number(
            resolved.grief
          ) || 0
        )
    };

    const specialTotal =
      raw.joy +
      raw.rage +
      raw.fear +
      raw.grief;

    // Each value is treated as an absolute percentage while their
    // sum is <= 100. If a test config exceeds 100%, preserve the
    // relative weights and normalize the special pool to 100%.
    const scale =
      specialTotal > 100
        ? 100 /
          specialTotal
        : 1;

    const special = {
      joy:
        raw.joy *
        scale,
      rage:
        raw.rage *
        scale,
      fear:
        raw.fear *
        scale,
      grief:
        raw.grief *
        scale
    };

    const normalizedTotal =
      special.joy +
      special.rage +
      special.fear +
      special.grief;

    return {
      ...special,
      attention:
        Math.max(
          0,
          100 -
          normalizedTotal
        )
    };
  }

  rollCell(
    context = {}
  ) {
    const chances =
      this.getEffectiveChances(
        context
      );

    const roll =
      Math.random() *
      100;

    let cursor = 0;

    cursor +=
      chances.joy;

    if (
      roll < cursor
    ) {
      return BUCKET_CELL_TYPES.JOY;
    }

    cursor +=
      chances.rage;

    if (
      roll < cursor
    ) {
      return BUCKET_CELL_TYPES.RAGE;
    }

    cursor +=
      chances.fear;

    if (
      roll < cursor
    ) {
      return BUCKET_CELL_TYPES.FEAR;
    }

    cursor +=
      chances.grief;

    if (
      roll < cursor
    ) {
      return BUCKET_CELL_TYPES.GRIEF;
    }

    return (
      BUCKET_CELL_TYPES.ATTENTION
    );
  }

  rollRow(
    slotCount,
    context = {}
  ) {
    const count =
      Math.max(
        0,
        Math.floor(
          Number(
            slotCount
          ) || 0
        )
      );

    const result =
      new Uint8Array(
        count
      );

    for (
      let index = 0;
      index < count;
      index += 1
    ) {
      result[index] =
        this.rollCell({
          ...context,
          slotIndex:
            index
        });
    }

    // Safety tail: loadingOrder 0 is the bottom-most row. Since
    // drain order ends at its slots 1 and 0, force those final two
    // drain cells to plain Attention so the user keeps a cancel window.
    if (
      context.loadingOrder === 0 &&
      count >= 2
    ) {
      result[0] =
        BUCKET_CELL_TYPES.ATTENTION;

      result[1] =
        BUCKET_CELL_TYPES.ATTENTION;
    }

    return result;
  }
}
