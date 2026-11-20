import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from feature_engineering import apparent_temperature_c, build_feature_transformer


class FeatureEngineeringTest(unittest.TestCase):
    def test_v1_to_v5_shapes_scaling_and_apparent_temperature(self):
        training = pd.DataFrame(
            {
                "temperature_c": [20.0, 25.0, 30.0],
                "relative_humidity": [30.0, 50.0, 70.0],
                "city": ["unused"] * 3,
            }
        )
        expected_widths = {"V1": 2, "V2": 2, "V3": 4, "V4": 5, "V5": 6}
        for version, width in expected_widths.items():
            transformed = build_feature_transformer(version).fit_transform(training)
            self.assertEqual(transformed.shape, (3, width))
            if version == "V1":
                np.testing.assert_allclose(transformed, training.iloc[:, :2])
            else:
                np.testing.assert_allclose(transformed.mean(axis=0), 0, atol=1e-12)

        # Formula check at T=30 C, RH=70%; no city/target field contributes.
        expected = 30 + 0.33 * (0.7 * 6.105 * np.exp(17.27 * 30 / 267.7)) - 4
        self.assertAlmostEqual(float(apparent_temperature_c(30, 70)), expected)


if __name__ == "__main__":
    unittest.main()
