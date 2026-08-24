export class FinaleController {
  constructor(
    overlay,
    panel,
    meltdownLayer,
    {
      onLockInput,
      onMeltdownStart
    } = {}
  ) {
    this.overlay =
      overlay;

    this.panel =
      panel;

    this.meltdown =
      meltdownLayer;

    this.onLockInput =
      onLockInput;

    this.onMeltdownStart =
      onMeltdownStart;

    this.state =
      "idle";

    this.boundConsumePointer =
      this.consumePointer.bind(
        this
      );

    this.boundConsumeKey =
      this.consumeKey.bind(
        this
      );
  }

  get active() {
    return (
      this.state !==
      "idle"
    );
  }

  get meltdownActive() {
    return (
      this.state ===
      "meltdown"
    );
  }

  showEntity() {
    if (
      this.active
    ) {
      return false;
    }

    this.state =
      "entity";

    this.onLockInput?.();

    this.overlay.hidden =
      false;

    this.overlay.addEventListener(
      "pointerdown",
      this.boundConsumePointer,
      {
        capture: true
      }
    );

    window.addEventListener(
      "keydown",
      this.boundConsumeKey,
      {
        capture: true
      }
    );

    requestAnimationFrame(
      () => {
        this.panel.focus({
          preventScroll: true
        });
      }
    );

    return true;
  }

  consumePointer(
    event
  ) {
    if (
      this.state !==
      "entity"
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.startMeltdown();
  }

  consumeKey(
    event
  ) {
    if (
      this.state ===
      "entity"
    ) {
      event.preventDefault();
      event.stopPropagation();

      this.startMeltdown();
      return;
    }

    if (
      this.state ===
      "meltdown"
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  startMeltdown() {
    if (
      this.state !==
      "entity"
    ) {
      return false;
    }

    this.state =
      "meltdown";

    this.overlay.hidden =
      true;

    this.overlay.removeEventListener(
      "pointerdown",
      this.boundConsumePointer,
      {
        capture: true
      }
    );

    this.onMeltdownStart?.();

    this.meltdown.activate();

    return true;
  }
}
