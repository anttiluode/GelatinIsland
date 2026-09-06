# Gelatin Island

**Neuron? Jello? Oscillating thing?** For now: a falsifiable computational toy for asking what happens when signals move through a writable medium and are accepted by receivers whose local state changes in time.

Live demo: **https://anttiluode.github.io/GelatinIsland/**

## Version 2 — grow the world, then poke it

The main page is now an interactive **excitable material**. Thousands of identical local carriers lay trails; trails consolidate into gel; gel determines signal propagation; excitation reinforces material and changes where carriers move next. There are no pre-drawn connections, assigned scout professions, or scheduled launch locations.

- **Pulse, Feed, Cut, Dam, Open** directly intervene in the simulated fields.
- **Freeze structure** lets signals travel through a held material geometry.
- **Does the shape matter?** sends an identical pulse into the grown material and a spatially shuffled copy with the same amount of gel and the same source neighbourhood.
- **Cinema** hides the interface; **Record 20s** exports the actual canvas as video on your device.
- **Save/Load world** preserves the complete state and random generator, not just the seed.
- Three parameter habitats: Estuary, Lace and Bloom. Desktop uses a larger grid than mobile.

Start here: **[Live signal garden](https://anttiluode.github.io/GelatinIsland/)**. The previous demo remains available as the **[original route × primer lab](https://anttiluode.github.io/GelatinIsland/primer.html)**.

This is an artificial medium, **not a validated neuron, evolved organism or demonstrated intelligent system**. Local chemotactic network formation has substantial prior art in Jeff Jones's Physarum models. The contribution here is the coupled simulation and its inspectable interventions. The biological inspirations motivate questions; they do not validate the equations.

See **[MODEL.md](MODEL.md)** for equations, exactly what is supplied, what grows, the probe protocol, prior art and limitations. The browser and Node experiments execute the same dependency-free [world engine](web/world.js).

Run the engine checks:

```bash
node --test tests/test_world.cjs
python -m unittest discover -s tests -v
```

For local use, serve this folder with `python -m http.server 8000` and open `http://localhost:8000`. Directly opening `index.html` also runs the garden; the background comparison needs an HTTP origin in browsers that restrict local-file workers. No paid API or server computation is needed.

## The original model: route × primer

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

## Research that remains

Version 2 makes the sea spatial and tests the causal effect of rearranging it. It does not yet solve the original hidden-field identifiability task, choose diagnostic actions autonomously, reproduce biological dendrites, or learn a useful input/output task. Those are separate experiments, not consequences of an organic appearance.

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
- [`index.html`](index.html), [`web/`](web/) — spatial garden and shared engine.
- [`primer.html`](primer.html) — preserved original scalar demo.
- [`MODEL.md`](MODEL.md) — spatial model, interventions and limits.

## License

MIT
