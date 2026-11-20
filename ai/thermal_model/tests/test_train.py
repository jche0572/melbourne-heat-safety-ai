import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from train import DEFAULT_DATA, load_data, multiclass_brier, split_data


class TrainingWorkflowTest(unittest.TestCase):
    def test_data_split_and_brier_score(self):
        # 这个最小测试同时检查真实数据可读、切分可复现，以及 Brier 公式正确。
        df = load_data(DEFAULT_DATA)
        train_index, test_index = split_data(df)
        # 689 行按 80/20 切分后应得到 551 行训练、138 行测试。
        self.assertEqual((len(train_index), len(test_index)), (551, 138))
        # 城市+类别分层后，测试集必须仍包含两个城市。
        self.assertEqual(set(df.loc[test_index, "city"]), {"Warsaw", "Madrid"})
        # 完全正确且置信度为 100% 的概率预测，其 Brier 分数应为 0。
        perfect = np.eye(3)[df.loc[test_index, "thermal_class_code"].astype(int)]
        self.assertEqual(multiclass_brier(df.loc[test_index, "thermal_class_code"], perfect, np.arange(3)), 0.0)


if __name__ == "__main__":
    unittest.main()
