#!/usr/bin/env python3
"""Gelatin Island: a small causal toy world.

The core factorization is deliberately simple:

    effective arrival = launch amplitude * route(M) * primer_i(t)

`route(M)` is the slow substrate / geometry term: can the signal physically get
from source to receiver? `primer_i(t)` is the fast local receiver term: is the
receiver receptive when the train arrives?

This is a computational model, not a claim that cortex literally contains this
specific primer field or gelatin substrate.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import math
from pathlib import Path
from typing import Dict, Any


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def wrap_phase(x: float) -> float:
    return math.atan2(math.sin(x), math.cos(x))


def phase_gate(phase: float, preferred: float = 0.0, floor: float = 0.05) -> float:
    """Smooth phase-dependent receiver gain in [floor, 1]."""
    floor = clamp01(floor)
    aligned = 0.5 * (1.0 + math.cos(wrap_phase(phase - preferred)))
    return floor + (1.0 - floor) * aligned


def phase_for_primer(target: float, floor: float = 0.05) -> float:
    """Return a phase offset whose phase_gate equals `target`.

    Useful for constructing passively indistinguishable worlds with different
    hidden causal decompositions.
    """
    target = float(target)
    if not floor <= target <= 1.0:
        raise ValueError("target must lie between floor and 1")
    c = (target - floor) / (1.0 - floor)
    cos_value = max(-1.0, min(1.0, 2.0 * c - 1.0))
    return math.acos(cos_value)


@dataclass
class Island:
    """A receiver/integrator with an oscillatory local receptive state."""

    name: str
    phase: float = 0.0
    preferred_phase: float = 0.0
    primer_floor: float = 0.05
    tau_ms: float = 100.0
    threshold: float = 0.6
    state: float = 0.0

    def primer(self) -> float:
        return phase_gate(self.phase, self.preferred_phase, self.primer_floor)

    def reset_state(self) -> None:
        self.state = 0.0

    def integrate(self, arrival: float, dt_ms: float) -> bool:
        """Leaky integration followed by an AIS-like launch threshold.

        This is intentionally minimal. It gives the island an absolute-time
        integration window without assuming a point-neuron instantaneous sum.
        """
        if self.tau_ms <= 0:
            raise ValueError("tau_ms must be positive")
        self.state *= math.exp(-float(dt_ms) / self.tau_ms)
        self.state += float(arrival)
        return self.state >= self.threshold


@dataclass
class Route:
    """A slow material route between islands.

    `conductance` is permanent structure. `memory` is a slower deposited trace
    left by traffic. Repeated use can make a route easier to traverse; the trace
    relaxes when unused.
    """

    source: str
    target: str
    conductance: float = 0.5
    delay_ms: float = 10.0
    memory: float = 0.0
    deposit_rate: float = 0.2
    memory_tau_ms: float = 1000.0

    def effective_conductance(self) -> float:
        base = clamp01(self.conductance)
        mem = clamp01(self.memory)
        return base + mem * (1.0 - base)

    def transmit(self, amplitude: float) -> float:
        return float(amplitude) * self.effective_conductance()

    def burn_in(self, traffic: float = 1.0) -> None:
        """Deposit a bounded route trace proportional to traffic."""
        self.memory += self.deposit_rate * abs(float(traffic)) * (1.0 - self.memory)
        self.memory = clamp01(self.memory)

    def relax(self, dt_ms: float) -> None:
        if self.memory_tau_ms <= 0:
            raise ValueError("memory_tau_ms must be positive")
        self.memory *= math.exp(-float(dt_ms) / self.memory_tau_ms)


def transfer(amplitude: float, route: Route, receiver: Island) -> float:
    """Factor slow routing and fast receiver receptivity."""
    return route.transmit(amplitude) * receiver.primer()


def gate0_primer_identifiability() -> Dict[str, Any]:
    """Two worlds look identical passively but differ under a phase poke.

    PATH-LIMITED: route = 0.5, receiver fully open.
    PRIMER-LIMITED: route = 1.0, receiver phase chosen so primer = 0.5.

    Both produce 0.5 at baseline. Setting the receiver to its preferred phase
    changes only the second world's hidden bottleneck, exposing the causal split.
    """
    open_receiver = Island("R", phase=0.0)
    weak_route = Route("S", "R", conductance=0.5)

    half_phase = phase_for_primer(0.5, open_receiver.primer_floor)
    half_open_receiver = Island("R", phase=half_phase)
    open_route = Route("S", "R", conductance=1.0)

    path_limited_baseline = transfer(1.0, weak_route, open_receiver)
    primer_limited_baseline = transfer(1.0, open_route, half_open_receiver)

    # Intervention: force the receiver phase into the preferred receptive phase.
    half_open_receiver.phase = half_open_receiver.preferred_phase
    path_limited_after_poke = transfer(1.0, weak_route, open_receiver)
    primer_limited_after_poke = transfer(1.0, open_route, half_open_receiver)

    passive_equal = math.isclose(path_limited_baseline, primer_limited_baseline, abs_tol=1e-12)
    poke_separates = not math.isclose(path_limited_after_poke, primer_limited_after_poke, abs_tol=1e-12)

    return {
        "name": "G0_PRIMER_IDENTIFIABILITY",
        "passive": {
            "path_limited": path_limited_baseline,
            "primer_limited": primer_limited_baseline,
            "equal": passive_equal,
        },
        "phase_poke": {
            "path_limited": path_limited_after_poke,
            "primer_limited": primer_limited_after_poke,
            "separates_hidden_causes": poke_separates,
        },
        "pass": bool(passive_equal and poke_separates),
    }


def gate1_arrival_phase() -> Dict[str, Any]:
    """Same route, same train, different arrival phase -> different effect."""
    route = Route("A", "B", conductance=0.8)
    receiver = Island("B", phase=0.0)
    preferred = transfer(1.0, route, receiver)
    receiver.phase = math.pi
    opposite = transfer(1.0, route, receiver)
    ratio = preferred / opposite if opposite else math.inf
    return {
        "name": "G1_ARRIVAL_PHASE",
        "preferred_phase_effect": preferred,
        "opposite_phase_effect": opposite,
        "preferred_to_opposite_ratio": ratio,
        "pass": bool(preferred > opposite * 5.0),
    }


def gate2_absolute_time_window() -> Dict[str, Any]:
    """Same four-pulse train, different island time constants."""
    fast = Island("FAST", tau_ms=40.0, threshold=0.6)
    slow = Island("SLOW", tau_ms=200.0, threshold=0.6)
    for _ in range(4):
        fast.integrate(0.25, 50.0)
        slow.integrate(0.25, 50.0)
    return {
        "name": "G2_ABSOLUTE_TIME_WINDOW",
        "pulse_count": 4,
        "pulse_spacing_ms": 50.0,
        "fast_tau_ms": fast.tau_ms,
        "slow_tau_ms": slow.tau_ms,
        "fast_final_state": fast.state,
        "slow_final_state": slow.state,
        "fast_launches": fast.state >= fast.threshold,
        "slow_launches": slow.state >= slow.threshold,
        "pass": bool(fast.state < fast.threshold <= slow.state),
    }


def gate3_route_burn_in() -> Dict[str, Any]:
    """Traffic writes a temporary path into the slow substrate."""
    route = Route("A", "B", conductance=0.35, deposit_rate=0.2, memory_tau_ms=1000.0)
    initial = route.effective_conductance()
    for _ in range(8):
        route.burn_in(1.0)
    burned = route.effective_conductance()
    route.relax(3000.0)
    recovered = route.effective_conductance()
    return {
        "name": "G3_ROUTE_BURN_IN",
        "initial_conductance": initial,
        "after_8_trains": burned,
        "after_3s_without_traffic": recovered,
        "pass": bool(burned > initial and initial < recovered < burned),
    }


def run_all_gates() -> Dict[str, Any]:
    gates = [
        gate0_primer_identifiability(),
        gate1_arrival_phase(),
        gate2_absolute_time_window(),
        gate3_route_burn_in(),
    ]
    return {
        "schema": "gelatin-island/gates-v1",
        "model_boundary": "computational toy; brain papers motivate tests but do not validate the toy",
        "equation": "effective_arrival = launch * route(material) * primer(receiver,time)",
        "gates": gates,
        "all_pass": all(g["pass"] for g in gates),
    }


def write_receipt(path: str | Path) -> Dict[str, Any]:
    receipt = run_all_gates()
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    return receipt


if __name__ == "__main__":
    receipt = run_all_gates()
    print(json.dumps(receipt, indent=2))
