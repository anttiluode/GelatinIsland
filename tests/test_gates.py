import math
import unittest

from gelatin_island import (
    Island,
    Route,
    gate0_primer_identifiability,
    gate1_arrival_phase,
    gate2_absolute_time_window,
    gate3_route_burn_in,
    phase_for_primer,
    phase_gate,
    transfer,
)


class GelatinIslandTests(unittest.TestCase):
    def test_phase_gate_bounds(self):
        for phase in [0.0, math.pi / 2, math.pi, -math.pi / 3, 7.0]:
            value = phase_gate(phase)
            self.assertGreaterEqual(value, 0.05)
            self.assertLessEqual(value, 1.0)

    def test_phase_for_primer_round_trip(self):
        phase = phase_for_primer(0.5)
        self.assertAlmostEqual(phase_gate(phase), 0.5, places=12)

    def test_route_and_primer_factorization(self):
        route = Route("A", "B", conductance=0.4)
        receiver = Island("B", phase=0.0)
        self.assertAlmostEqual(transfer(2.0, route, receiver), 0.8)
        receiver.phase = math.pi
        self.assertAlmostEqual(transfer(2.0, route, receiver), 0.04)

    def test_g0_passive_equivalence_active_separation(self):
        result = gate0_primer_identifiability()
        self.assertTrue(result["passive"]["equal"])
        self.assertTrue(result["phase_poke"]["separates_hidden_causes"])
        self.assertTrue(result["pass"])

    def test_g1_arrival_phase(self):
        result = gate1_arrival_phase()
        self.assertGreater(result["preferred_to_opposite_ratio"], 5.0)
        self.assertTrue(result["pass"])

    def test_g2_absolute_time_window(self):
        result = gate2_absolute_time_window()
        self.assertFalse(result["fast_launches"])
        self.assertTrue(result["slow_launches"])
        self.assertTrue(result["pass"])

    def test_g3_route_burn_in_and_relaxation(self):
        result = gate3_route_burn_in()
        self.assertGreater(result["after_8_trains"], result["initial_conductance"])
        self.assertLess(result["after_3s_without_traffic"], result["after_8_trains"])
        self.assertGreater(result["after_3s_without_traffic"], result["initial_conductance"])
        self.assertTrue(result["pass"])


if __name__ == "__main__":
    unittest.main()
