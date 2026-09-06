# Gelatin Island 2: an excitable, writable material

The browser and headless experiments execute **the same engine**, [`web/world.js`](web/world.js). The renderer only reads its state. This is a computational construction, not a fitted model of a neuron, a new physical theory, or demonstrated open-ended life.

## What is supplied, and what forms

Supplied: identical carrier rules; continuous sensing-radius variation; seven broad nutrient patches; a replenishing nutrient reservoir; excitation and recovery equations; a local charging/launch rule; boundaries; a random seed. Carrier number stays fixed. There is no reproduction, evolution, global fitness selection, destination lookup, predefined graph, assigned profession, or separate Train/Neuron object.

Formed by the update rules: trails, thickened material, connected regions, local launch locations, propagation paths, and changes to those paths. Calling these *islands*, *veins*, or *trains* describes their appearance. It does not add an entity to the engine. The launch **rule** is explicitly programmed; its location and timing depend on local state.

## State and timescales

| Variable | Meaning | Main role |
|---|---|---|
| Carrier position and heading | Motile field writers, each with three nearby samples | Explore and deposit traffic |
| `trail`, T | Diffusing, decaying carrier trace | Medium-lived guidance |
| `gel`, M | Slowly consolidated material, in [0,1] | Persistent geometry and conductance |
| `excite`, U | Local activation, in [0,1] | Fast regenerative transmission |
| `recover`, V | Low-pass trace of excitation | Refractory state / local receptivity |
| `food`, N | Available resource, in [0,1] | Pays for motion, growth and excitation |
| `supply`, S | External reservoir level | Nutrient geography, editable by Feed |
| `charge`, Q | Local integration state; values above 1 mark an emission plateau | Threshold launch |
| `wall` | Impermeable signal/carrier obstacle | Intervention geometry |

Ticks and lattice cells are dimensionless. One playback second normally advances 30 ticks. A tick is not a biological millisecond. Visual FPS changes drawing frequency; fixed simulation steps determine the dynamics. Saved worlds contain the random state and all persistent fields, so the same engine can resume them exactly.

## The local update

Carriers sample forward, left and right at a distance set by the habitat. Their sensed scalar is

`T + 0.18 M + 1.1 N − 1.2 V`.

They turn towards the better local sample, with small seeded angular noise. Movement slows in thicker material and increases with local activation and food. Crowded or blocked destinations cause a turn; there is no long-distance target. They deposit a trace and consume local food. Carrier updates are sequential, so carrier ordering is part of the model; fields then update synchronously from double buffers.

With Δ the four-neighbour Laplacian, the material update is

`M_next = clip(M + [g max(T−0.10,0) + b U T] (1−M) N − e M + 0.018 ΔM)`.

`g`, `b` and `e` are habitat parameters. The second deposition term is the explicit signal-write rule. The **Signals write memory** switch removes this term only. Activation and recovery still influence carriers, so that switch is not an ablation of every signal-to-structure interaction.

Material sets conductance:

`K = 0.015 + 1.35 smoothstep(0.045, 0.28, M)`.

For neighbouring unblocked cells i,j, face conductance is the harmonic mean `2 K_i K_j / (K_i+K_j)`. A wall face has conductance zero. Symmetric faces give a conservative **diffusion term**, but the entire system is driven and dissipative, not mass- or energy-conserving.

The fast field follows a bounded cubic excitable rule:

`theta = 0.115 + 0.64 V + 0.10 (1−N) + 0.40 (1−smoothstep(0.045,0.28,M))`

`U_next = clip(U + 0.52 U(1−U)(U−theta) + 0.145 sum_j K_ij (U_j−U_i))`

`V_next = clip(V + 0.026 (U−V))`.

This is a custom discrete excitable-medium rule in the reaction–diffusion tradition, not Hodgkin–Huxley, an NMDA model, or a calibrated FitzHugh–Nagumo implementation. Thicker material supports regeneration more readily; recovery raises the activation threshold. Signals are local state propagated by these equations, not particles moved along rendered curves.

Food diffuses, relaxes towards S at rate 0.003, and is consumed by carrier visits, activity and growth. This external supply keeps the world out of equilibrium. Feed edits S and N locally. Walls absorb adjacent trail/food diffusion; they have zero flux for excitation. No conservation claim is made for nutrients or structural mass.

Q integrates `0.0036 × drive × material_gate × N × (1−V)` and leaks. When it exceeds 0.72 in sufficiently receptive, fed material, it launches a finite emission plateau: U is held at least 0.96 for about 20 ticks. Recovery and local consumption follow. This small plateau is necessary because a one-cell, one-tick injection often dissipates before recruiting neighbours. It is an explicit local mechanism, not an emergent action-potential discovery. Turning spontaneous launches off prevents new charging; existing plateaus finish within 21 ticks.

## A causal test of shape

The **Does the shape matter?** button uses a background worker and leaves the live world alone:

1. Copy the current state; choose a source by material strength weighted mildly towards the centre, **before observing any probe outcome**.
2. Freeze carrier motion and M/T updates; turn off spontaneous launches; reset U,V,Q; set food and reservoir to 0.8 on non-wall cells.
3. Make a second copy. Fisher–Yates shuffle its gel values outside an 8-cell source disk, excluding walls. The gel histogram and source neighbourhood are preserved exactly. This intentionally destroys spatial correlation and is a strong null, not a realistic alternate growth process.
4. Inject the identical radius-4 pulse into both copies, then advance 360 ticks.
5. Count cells **outside the protected disk** whose excitation ever crosses 0.5, and record maximum distance and integrated excitation. Maps show peak excitation, not a single selected favourable frame.

A difference establishes a causal effect of gel arrangement in this model and snapshot. It does not establish learning, optimal routing, generalization, cognition, or superiority to conventional algorithms. A spatial shuffle can also improve a particular response. The UI reports either direction. Seed sweeps report every seed and are exploratory; parameters were developed using seed 42, which is listed separately from additional seeds.

## Controls and practical limits

- **Pulse:** local finite injection. Repeated dragging is repeated external input.
- **Cut:** remove gel/trail and activity locally. Carriers can regrow the route.
- **Dam / Open:** add or remove a lasting barrier.
- **Freeze structure:** halt carrier motion and M/T change, while fast state and food continue.
- **Save / Load world:** includes persistent arrays, seed state, habitat parameters, counters and switches. Old/new engine versions can differ numerically; use the recorded version/commit.
- **Cinema:** hides the controls. **Record 20s:** records actual canvas frames on the user's device; output format follows browser MediaRecorder support.
- Desktop and mobile use different grid sizes for performance. A seed alone is not the full initial condition; full snapshots include dimensions and carrier count.
- The WebGL view shades the measured fields with simulated lighting. The Canvas fallback is a simpler field view. Neither lighting, palette nor carrier visibility affects dynamics.
- Numerical clipping is an explicit stabilizer. It is not evidence of physical boundedness. Fine-grid convergence, sensitivity to carrier order, domain size and thresholds, and long-term dynamics remain open checks.

## Relation to the earlier work

The earlier scalar route × phase-primer model remains in `gelatin_island.py` and [`primer.html`](primer.html). Its G0–G3 tests are unchanged. Version 2 replaces a drawn route with a spatial field; recovery now supplies a refractory receptivity variable rather than the old imposed phase gate. It is a related model, not a numerical reproduction of the scalar gates. Multi-compartment islands with a distinct AIS boundary have **not** yet been implemented.

Prior art and biological motivations:

- Jones, *The Emergence and Dynamical Evolution of Complex Transport Networks from Simple Low-Level Behaviours*: https://arxiv.org/abs/1503.06579 — local particle chemotaxis and field-written networks. This mechanism has substantial prior art.
- Drebitz et al. (2025): https://doi.org/10.1038/s41467-025-62732-8 — receiver timing motivates separating physical arrival from receptivity.
- Norman-Haignere et al. (2025): https://doi.org/10.1038/s41593-025-02060-8 — motivates explicit integration timescales.
- Leterrier (2018): https://doi.org/10.1523/JNEUROSCI.1922-17.2018 — motivates the question of a structured launch boundary, not validation of this Q rule.
- Aizenbud et al. (2026): https://doi.org/10.1073/pnas.2533168123 — morphology and nonlinear synapses contribute to modeled single-neuron input/output complexity. This toy has neither their biological reconstructions nor their synapse model.

The useful next research step is a held-out input/output task with equal-resource baselines, once spatial routing and signal-written history have been measured. Beauty and a causal shape effect are distinct from useful learned computation.
