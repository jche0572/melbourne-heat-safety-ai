import sys
import unittest
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from feature_experiment import select_configuration


class FeatureExperimentTest(unittest.TestCase):
    def test_saved_training_results_select_v4_ordinal_without_test_metrics(self):
        summary = pd.read_csv(ROOT / "results" / "feature_engineering" / "training_oof_summary.csv")
        selected, _ = select_configuration(summary)
        self.assertEqual((selected.feature_set, selected.model), ("V4", "ordinal_logistic"))
        self.assertNotIn("test", " ".join(summary.columns).lower())


if __name__ == "__main__":
    unittest.main()
