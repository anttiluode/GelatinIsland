# Gelatin Island

**Neuron? Jello? Oscillating thing?** For now: a falsifiable computational toy for asking what happens when signals move through a writable medium and are accepted by receivers whose local state changes in time.

Live demo: **https://anttiluode.github.io/GelatinIsland/**

## The first useful split: route × primer

The repo starts from one factorization:

```text
effective arrival
    = launch amplitude
    × route(material)
    × primer(receiver, time)
```

or

\[
y_{j\to i}(t)=a_j\,T_{ji}(M_t)\,P_i(t).
\]

- `T_ji(M)` — **slow routing**. How easily can a signal physically reach island `i` from island `j` through the current material/substrate?
- `P_i(t)` — **primer / receptivity**. If the signal arrives now, how strongly can island `i` respond?

This cleanly separates two things that can look identical under passive observation. Weak transmission can mean **bad route** or **closed receiver**.

That distinction is the first causal gate.

## Why "primer" is useful

`primer` is deliberately a neutral toy-world word. In the current model it is a phase-dependent local gain. It is not a claim that the brain has a literal chemical called Primer.

A receiver can be perfectly connected and still ignore an arriving train because it is in the wrong local state. Conversely, a fully receptive receiver can see almost nothing because the route is poor.

The product can be the same. A poke can reveal the hidden decomposition.

## G0 — identical passive output, different hidden cause

Construct two worlds:

```text
PATH-LIMITED
route  = 0.5
primer = 1.0
output = 0.5

PRIMER-LIMITED
route  = 1.0
primer = 0.5
output = 0.5
```

Passive observation cannot distinguish them.

Now perform one intervention: set the receiver to its preferred receptive phase.

```text
PATH-LIMITED   stays 0.5
PRIMER-LIMITED rises to 1.0
```

So the same passive transfer can hide different causal machines.

This is the direct bridge to the bounded-observer / poke work: **structure alone does not identify the causal role; intervention can.**

## First four gates

| Gate | Question | Receipt |
|---|---|---|
| **G0 Primer Identifiability** | Can a poke distinguish route-limited from receiver-limited worlds with identical passive output? | PASS |
| **G1 Arrival Phase** | Same train + same route: does receiver phase change effect? | PASS |
| **G2 Absolute Time Window** | Can two islands integrate the same pulse train differently solely because their local time constants differ? | PASS |
| **G3 Route Burn-In** | Can repeated traffic temporarily write an easier path into the slow substrate? | PASS |

The deterministic receipt is in [`results/gate_receipt.json`](results/gate_receipt.json).

Run it:

```bash
python experiments/run_gates.py --check
```

No third-party Python packages are required.

## FAST / MEDIUM / SLOW

The current toy separates three timescales without pretending they are yet a biological theory:

```text
FAST
train arrival + receiver phase

MEDIUM
island integration state / local time window

SLOW
material route + deposited traffic trace
```

This gives a concrete architecture:

```text
slow substrate
    ↓ compiles
propagation route
    ↓
train arrives
    ×
fast receiver primer
    ↓
local island integration
    ↓
AIS-like threshold / launch
    ↓
new train
    ↓
traffic can rewrite slow substrate
```

The slow material is therefore not merely memory *stored beside* computation. It changes the operator that future signals experience.

## Why the brain papers are relevant — and what they do **not** prove

Four recent/related papers motivated specific pieces of the toy:

1. **Drebitz, Rausch & Kreiter (2025), Nature Communications** — electrically evoked V2 spike volleys had strongly phase-dependent downstream effects in V4 and behavior. This motivates a receiver-side timing gate; it does not establish this toy's exact `primer` equation. DOI: `10.1038/s41467-025-62732-8`.
2. **Norman-Haignere et al. (2025), Nature Neuroscience** — human auditory cortical integration windows increase substantially across hierarchy and are predominantly yoked to absolute time. This motivates explicit local integration time constants. DOI: `10.1038/s41593-025-02060-8`.
3. **Leterrier (2018), Journal of Neuroscience** — the axon initial segment generates/shapes action potentials, separates somatodendritic and axonal compartments, and is structurally plastic. This motivates an island-to-train launch boundary. DOI: `10.1523/JNEUROSCI.1922-17.2018`.
4. **Aizenbud et al. (2026), PNAS** — dendritic morphology, compartmentalization and NMDA nonlinearities contribute to modeled single-neuron functional complexity. This motivates islands that eventually become spatial bodies rather than point sums. DOI: `10.1073/pnas.2533168123`.

These are **inspirations and constraints**, not validation of Gelatin Island.

## The next serious step

Do **not** add ten mechanisms at once.

The next gate should make the sea spatial:

> Can two different material fields produce the same passive source→receiver response, while a small set of diagnostic trains identifies which hidden field is present?

That would turn `POKE` from a scalar intervention into an actual propagating probe.

After that, the interesting question is whether a system can learn **when a diagnostic train is worth launching** without being handed a global map.

## Non-claims

This repo currently does **not** claim:

- that the brain is gelatin;
- that EEG spectral slowing means axonal trains literally move more slowly;
- that an electric/ephaptic field is the primary mechanism;
- that `primer` is a known biological variable;
- that the toy explains consciousness, Alzheimer's disease, or cortical computation.

The point is to build a world where these ideas can be separated and attacked one at a time.

## Files

- [`gelatin_island.py`](gelatin_island.py) — core pure-Python model.
- [`experiments/run_gates.py`](experiments/run_gates.py) — deterministic G0–G3 runner.
- [`tests/test_gates.py`](tests/test_gates.py) — unit tests.
- [`results/gate_receipt.json`](results/gate_receipt.json) — frozen initial receipt.
- [`index.html`](index.html) — interactive Pages demo.

## License

MIT
