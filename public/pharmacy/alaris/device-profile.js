// Reference device-capability model.
//
// This file is deliberately SEPARATE from the drug library (engine.js entries) and from
// institutional order-entry policy. A drug library says what a medication may be given at.
// This file says what the *hardware* can physically accept, program and display.
// The two are versioned independently and must never be merged.
//
// PROVENANCE RULE: every constraint below carries a `sourceType`.
//   'reference-manual'  — read from the public manufacturer manual cited in
//                         sources/alaris-clinical-validation-sources.md (printed pp. 186, 189-190).
//                         It describes a PUBLIC REFERENCE configuration. It is NOT evidence of
//                         the firmware or configuration installed at this institution (CF-04).
//   'simulator-guard'   — a plausibility bound chosen for this trainer because no confirmed
//                         institutional value exists. Clearly a simulator decision, not a device claim.
//
// Maxima on the real reference device are described as configurable per profile/data set. The
// values here are therefore the UNCONFIGURED reference envelope. Never treat a missing
// institutional setting as zero, as "disabled", or as confirmation of these defaults.

export const DEVICE_CAPABILITY_MODEL = {
  id: 'reference-lvp',
  label: 'Reference large-volume pump module',
  modelVersion: '1.0.0',
  revised: '2026-09-20',
  institutionVerified: false,
  institutionVerifiedNote:
    'Installed firmware, data-set version and configured per-profile maxima are NOT established (CF-04). ' +
    'These are public reference defaults shown for training realism only.',
  citation: {
    sourceId: 'manual-v12-1',
    title: 'BD Alaris System with Guardrails Suite MX User Manual (v12.1 reference baseline)',
    printedPages: ['186', '189-190'],
    note: 'Reference version only; not asserted to be the installed version.',
  },
  constraints: {
    flow: {
      min: 0.1,
      max: 999,
      unit: 'mL/h',
      sourceType: 'reference-manual',
      configurable: true,
      note: 'Pump-module flow-rate envelope. Profile maxima may be configured lower; unknown here.',
    },
    directRateResolution: {
      tiers: [
        { below: 100, step: 0.1 },
        { from: 100, step: 1 },
      ],
      unit: 'mL/h',
      sourceType: 'reference-manual',
      note: 'User-entered Pump Module rate increment changes at 100 mL/h.',
    },
    calculatedRateResolution: {
      tiers: [
        { below: 10, step: 0.01 },
        { from: 10, below: 100, step: 0.1 },
        { from: 100, step: 1 },
      ],
      unit: 'mL/h',
      sourceType: 'reference-manual',
      note: 'Device-calculated Pump Module rates use 0.01 mL/h increments below 10 mL/h.',
    },
    volume: {
      min: 0.1,
      max: 9999,
      unit: 'mL',
      sourceType: 'reference-manual',
      configurable: true,
      note: 'Volume-to-be-infused envelope, separate from any drug-library limit.',
    },
    volumeResolution: {
      tiers: [
        { below: 100, step: 0.1 },
        { from: 100, step: 1 },
      ],
      unit: 'mL',
      sourceType: 'reference-manual',
      note: 'Programmable volume increment changes at 100 mL.',
    },
    weight: {
      min: 0.25,
      max: 500,
      unit: 'kg',
      sourceType: 'simulator-guard',
      configurable: true,
      note:
        'NOT a manufacturer specification. The institution\'s configured weight range is unverified. ' +
        'This bound only stops physically implausible trainer input (CF-01) and must be replaced ' +
        'with the confirmed configured range before any institutional use.',
    },
  },
};

const M = DEVICE_CAPABILITY_MODEL.constraints;

/** Programmable step for a value, from the model's tier table. Tier is chosen from the
 *  un-quantized value; a value that crosses the tier boundary after rounding keeps the
 *  step it was evaluated with. */
export function stepFor(value, table) {
  if (!Number.isFinite(value)) return NaN;
  const magnitude = Math.abs(value);
  for (const tier of table.tiers) {
    const aboveLowerBound = tier.from === undefined || magnitude >= tier.from;
    const belowUpperBound = tier.below === undefined || magnitude < tier.below;
    if (aboveLowerBound && belowUpperBound) return tier.step;
  }
  return table.tiers.at(-1).step;
}

export const directRateStep = rate => stepFor(rate, M.directRateResolution);
export const calculatedRateStep = rate => stepFor(rate, M.calculatedRateResolution);
export const volumeStep = volume => stepFor(volume, M.volumeResolution);

const decimalsOf = step => {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
};

/**
 * Round a value onto the device's programmable increment.
 *
 * Deliberately integer-scaled and explicitly half-up. Dividing by a decimal step and calling
 * Math.round is NOT safe here: 0.35 / 0.1 is 3.4999999999999996 in binary floating point, so a
 * value sitting exactly on a half-increment would round down or up depending on its binary
 * representation. A device constraint model must be deterministic at every boundary.
 */
export function quantize(value, step) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return NaN;
  const places = decimalsOf(step);
  const scale = 10 ** places;
  const stepUnits = Math.round(step * scale);
  const scaled = Number((value * scale).toPrecision(12));
  const units = Math.floor(scaled / stepUnits + 0.5) * stepUnits;
  return Number((units / scale).toFixed(places));
}

/** True when the learner's entered value already sits exactly on a programmable increment. */
export function onResolution(value, step) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return false;
  return Math.abs(value - quantize(value, step)) < 1e-9;
}

export const quantizeDirectRate = rate => quantize(rate, directRateStep(rate));
export const quantizeCalculatedRate = rate => quantize(rate, calculatedRateStep(rate));
export const quantizeVolume = volume => quantize(volume, volumeStep(volume));

/**
 * Documented display policy for the module rate readout.
 *
 * Policy (a simulator decision, recorded so it can be tested on both sides of every boundary):
 *   rate >= 100  -> 0 decimals   (increment is 1 mL/h)
 *   10 <= rate < 100 -> 1 decimal
 *   rate < 10    -> 2 decimals   (the reference module does not apply a single one-decimal rule
 *                                 to every calculated rate below 10 mL/h)
 * GUARANTEE: a nonzero flow is never displayed as "0". If the policy above would render zero,
 * precision is extended until a nonzero digit appears (capped at 6 decimals). This closes CF-03,
 * where 0.0375 mL/h displayed as 0 while the channel was marked INFUSING.
 */
export function displayRate(rate) {
  if (!Number.isFinite(rate)) return '—';
  if (rate === 0) return '0';
  const decimals = Math.abs(rate) >= 100 ? 0 : Math.abs(rate) >= 10 ? 1 : 2;
  for (let places = decimals; places <= 6; places++) {
    const text = rate.toFixed(places);
    if (Number(text) !== 0) return text;
  }
  return rate > 0 ? '>0' : '<0';
}

/**
 * The separate Pump Module LED has less precision than the PC-unit display. The public
 * manufacturer FAQ states that an LVP rate below 100 mL/h is shown to one decimal place on
 * the module even when the PC unit shows a device-calculated rate below 10 to two decimals.
 * The rounded module value is display-only; delivery continues at `result.rate`.
 */
export function displayModuleRate(rate) {
  if (!Number.isFinite(rate)) return '—';
  if (rate === 0) return '0';
  return Math.abs(rate) >= 100 ? rate.toFixed(0) : rate.toFixed(1);
}

const label = constraint =>
  constraint.sourceType === 'reference-manual' ? 'reference device default' : 'simulator guard';

/**
 * Device-capability check, independent of drug-library limits.
 *
 * `directEntry` marks values the learner keys in literally (a volumetric mL/h rate, and VTBI).
 * Those must already sit on a programmable increment — a real keypad cannot express 100.1 mL/h
 * when the increment is 1. A rate the device *calculates* from a dose is instead quantized onto
 * the deliverable increment, and the difference is reported so the engine and the display agree.
 */
export function checkDeviceProgram({ rate, vtbi, weight, directRateEntry = false, weightRequired = false }) {
  const problems = [];
  const notices = [];

  if (weightRequired) {
    if (!Number.isFinite(weight) || weight < M.weight.min || weight > M.weight.max) {
      problems.push(
        `Weight ${Number.isFinite(weight) ? weight : '—'} kg is outside the accepted range of ` +
        `${M.weight.min}–${M.weight.max} kg (${label(M.weight)}).`,
      );
    }
  }

  if (!Number.isFinite(rate)) {
    problems.push('The programmed values do not produce a finite flow rate.');
    return { ok: false, problems, notices, deliveredRate: NaN };
  }

  if (rate < M.flow.min || rate > M.flow.max) {
    problems.push(
      `${displayRate(rate)} mL/h is outside the pump's flow range of ` +
      `${M.flow.min}–${M.flow.max} mL/h (${label(M.flow)}). Reprogram; this cannot be delivered.`,
    );
  }

  if (!Number.isFinite(vtbi) || vtbi < M.volume.min || vtbi > M.volume.max) {
    problems.push(
      `VTBI ${Number.isFinite(vtbi) ? vtbi : '—'} mL is outside the pump's volume range of ` +
      `${M.volume.min}–${M.volume.max} mL (${label(M.volume)}).`,
    );
  } else if (!onResolution(vtbi, volumeStep(vtbi))) {
    problems.push(
      `VTBI ${vtbi} mL cannot be entered: the volume increment at this value is ` +
      `${volumeStep(vtbi)} mL (${label(M.volumeResolution)}).`,
    );
  }

  let deliveredRate = rate;
  const withinFlow = rate >= M.flow.min && rate <= M.flow.max;
  if (withinFlow) {
    const resolution = directRateEntry ? M.directRateResolution : M.calculatedRateResolution;
    const step = directRateEntry ? directRateStep(rate) : calculatedRateStep(rate);
    if (directRateEntry && !onResolution(rate, step)) {
      problems.push(
        `A rate of ${rate} mL/h cannot be entered: the rate increment at this value is ` +
        `${step} mL/h (${label(resolution)}).`,
      );
    } else {
      deliveredRate = quantize(rate, step);
      if (Math.abs(deliveredRate - rate) > 1e-9) {
        notices.push(
          `Calculated rate ${displayRate(rate)} mL/h is delivered at ${displayRate(deliveredRate)} mL/h, ` +
          `the nearest ${step} mL/h increment (${label(resolution)}).`,
        );
      }
      if (deliveredRate < M.flow.min) {
        problems.push(
          `Rounding to the ${step} mL/h increment would stop delivery. Reprogram (${label(resolution)}).`,
        );
      }
    }
  }

  return { ok: problems.length === 0, problems, notices, deliveredRate };
}

/** Human-readable provenance rows for the UI and the validation record. */
export function capabilityRows() {
  return [
    ['Flow range', `${M.flow.min}–${M.flow.max} mL/h`, label(M.flow)],
    ['Rate increments', 'Entered: 0.1 below 100; calculated: 0.01 below 10, then 0.1; both 1 at 100+', label(M.directRateResolution)],
    ['VTBI range', `${M.volume.min}–${M.volume.max} mL`, label(M.volume)],
    ['Volume increment', '0.1 mL below 100; 1 mL at and above 100', label(M.volumeResolution)],
    ['Weight range', `${M.weight.min}–${M.weight.max} kg`, label(M.weight)],
  ];
}
