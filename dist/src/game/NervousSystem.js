import {
  getBucketCellMeta
} from "./GachaSystem.js";

const BUFFER_MAX_VALUE = 10;
const EPSILON = 0.0001;

const TYPE_BY_ID = Object.freeze({
  joy: 1,
  rage: 2,
  fear: 3,
  grief: 4
});

const EMOTION_AXIS = Object.freeze({
  joy: Object.freeze({ axis: "x", direction: 1 }),
  grief: Object.freeze({ axis: "x", direction: -1 }),
  rage: Object.freeze({ axis: "y", direction: 1 }),
  fear: Object.freeze({ axis: "y", direction: -1 })
});

export class NervousSystem {
  constructor(config, { onBufferChanged, onEmotionScored } = {}) {
    this.config = config;
    this.x = 0;
    this.y = 0;
    this.displayAxis = null;
    this.scores = { joy: 0, grief: 0, rage: 0, fear: 0 };
    this.onBufferChanged = onBufferChanged;
    this.onEmotionScored = onEmotionScored;
    this.emitBuffer();
  }

  get maxValue() { return BUFFER_MAX_VALUE; }

  get decayPerSecond() {
    const configured = Number(this.config.nervousBufferDecayPerSecond);
    return Math.max(0, Number.isFinite(configured) ? configured : 0.10);
  }

  getAxisValue(axis) { return axis === "x" ? this.x : this.y; }
  setAxisValue(axis, value) { if (axis === "x") this.x = value; else this.y = value; }

  getEmotionForAxisValue(axis, value) {
    if (Math.abs(value) <= EPSILON) return null;
    if (axis === "x") return value > 0 ? "joy" : "grief";
    return value > 0 ? "rage" : "fear";
  }

  normalizeNearZero() {
    if (Math.abs(this.x) <= EPSILON) this.x = 0;
    if (Math.abs(this.y) <= EPSILON) this.y = 0;
  }

  refreshDisplayAxis(preferredAxis = null) {
    this.normalizeNearZero();
    if (this.displayAxis && Math.abs(this.getAxisValue(this.displayAxis)) > EPSILON) return;
    this.displayAxis = null;
    if (preferredAxis && Math.abs(this.getAxisValue(preferredAxis)) > EPSILON) {
      this.displayAxis = preferredAxis;
      return;
    }
    if (Math.abs(this.x) > EPSILON) { this.displayAxis = "x"; return; }
    if (Math.abs(this.y) > EPSILON) this.displayAxis = "y";
  }

  getDisplayState() {
    this.refreshDisplayAxis();
    if (!this.displayAxis) {
      return { emotion: null, value: 0, maxValue: this.maxValue, ratio: 0, color: null, x: this.x, y: this.y, scores: { ...this.scores } };
    }
    const rawValue = this.getAxisValue(this.displayAxis);
    const emotion = this.getEmotionForAxisValue(this.displayAxis, rawValue);
    const meta = emotion ? getBucketCellMeta(TYPE_BY_ID[emotion]) : null;
    const value = Math.abs(rawValue);
    return {
      emotion,
      value,
      maxValue: this.maxValue,
      ratio: Math.max(0, Math.min(1, value / this.maxValue)),
      color: meta?.color ?? null,
      x: this.x,
      y: this.y,
      scores: { ...this.scores }
    };
  }

  collectEmotion(emotion) {
    const normalized = String(emotion ?? "").trim().toLowerCase();
    const mapping = EMOTION_AXIS[normalized];
    if (!mapping) return null;
    this.setAxisValue(mapping.axis, this.getAxisValue(mapping.axis) + mapping.direction);
    if (!this.displayAxis) this.displayAxis = mapping.axis;

    let scoredEmotion = null;
    const current = this.getAxisValue(mapping.axis);
    if (Math.abs(current) >= this.maxValue) {
      scoredEmotion = this.getEmotionForAxisValue(mapping.axis, current);
      if (scoredEmotion) {
        this.scores[scoredEmotion] += 1;
        this.onEmotionScored?.({ emotion: scoredEmotion, total: this.scores[scoredEmotion], scores: { ...this.scores } });
      }
      this.setAxisValue(mapping.axis, 0);
    }

    this.refreshDisplayAxis(mapping.axis);
    return this.emitBuffer({ collectedEmotion: normalized, scoredEmotion });
  }

  increaseActiveBuffer(
    amount = 1
  ) {
    this.refreshDisplayAxis();

    if (
      !this.displayAxis
    ) {
      return this.emitBuffer({
        debugAction:
          "increase-active-buffer-noop"
      });
    }

    const rawValue =
      this.getAxisValue(
        this.displayAxis
      );

    const emotion =
      this.getEmotionForAxisValue(
        this.displayAxis,
        rawValue
      );

    if (
      !emotion
    ) {
      return this.emitBuffer({
        debugAction:
          "increase-active-buffer-noop"
      });
    }

    const increments =
      Math.max(
        1,
        Math.floor(
          Number(amount) || 1
        )
      );

    let state = null;

    for (
      let index = 0;
      index < increments;
      index += 1
    ) {
      state =
        this.collectEmotion(
          emotion
        );

      // Hitting 10 scores and resets the active axis. Do not accidentally
      // start increasing a hidden/opposite axis in the same button press.
      if (
        state?.scoredEmotion
      ) {
        break;
      }
    }

    return state;
  }

  resetActiveBuffer() {
    this.refreshDisplayAxis();

    if (
      !this.displayAxis
    ) {
      return this.emitBuffer({
        debugAction:
          "reset-active-buffer-noop"
      });
    }

    const resetAxis =
      this.displayAxis;

    this.setAxisValue(
      resetAxis,
      0
    );

    this.displayAxis = null;
    this.refreshDisplayAxis();

    return this.emitBuffer({
      debugAction:
        "reset-active-buffer",
      resetAxis
    });
  }

  approachZero(value, amount) {
    if (value > 0) return Math.max(0, value - amount);
    if (value < 0) return Math.min(0, value + amount);
    return 0;
  }

  update(deltaMs) {
    const decay = this.decayPerSecond * Math.max(0, deltaMs) / 1000;
    if (decay <= 0) return;
    const px = this.x, py = this.y;
    this.x = this.approachZero(this.x, decay);
    this.y = this.approachZero(this.y, decay);
    this.normalizeNearZero();
    this.refreshDisplayAxis();
    if (px !== this.x || py !== this.y) this.emitBuffer();
  }

  emitBuffer(extra = {}) {
    const state = { ...this.getDisplayState(), ...extra };
    this.onBufferChanged?.(state);
    return state;
  }
}
