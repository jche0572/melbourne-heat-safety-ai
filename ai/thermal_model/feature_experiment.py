"""Run leakage-safe feature-engineering experiments on the fixed training split."""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import StratifiedKFold
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from feature_engineering import FEATURE_NAMES, FEATURE_SETS, make_feature_pipeline
from train import (
    CITY,
    CLASS_NAMES,
    DEFAULT_DATA,
    FEATURES,
    RANDOM_STATE,
    TARGET,
    OrdinalLogisticClassifier,
    evaluate_predictions,
    load_data,
    split_data,
)

RESULTS_DIR = ROOT / "results" / "feature_engineering"
ARTIFACTS_DIR = ROOT / "artifacts" / "feature_engineering"
MODEL_ORDER = ("ordinal_logistic", "random_forest", "xgboost")
FEATURE_COMPLEXITY = {name: rank for rank, name in enumerate(FEATURE_SETS, start=1)}
MODEL_COMPLEXITY = {name: rank for rank, name in enumerate(MODEL_ORDER, start=1)}


def build_models():
    """Reuse the model types and already-selected training-only parameters."""
    return {
        "ordinal_logistic": OrdinalLogisticClassifier(),
        "random_forest": RandomForestClassifier(
            n_estimators=300,
            max_depth=6,
            min_samples_leaf=1,
            class_weight="balanced",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        "xgboost": XGBClassifier(
            objective="multi:softprob",
            num_class=3,
            eval_metric="mlogloss",
            n_estimators=200,
            max_depth=3,
            learning_rate=0.1,
            subsample=0.8,
            random_state=RANDOM_STATE,
            n_jobs=1,
        ),
    }


def aligned_probabilities(model, X) -> np.ndarray:
    """Return probability columns in the fixed 0, 1, 2 class order."""
    probabilities = model.predict_proba(X)
    classes = np.asarray(model.named_steps["model"].classes_, dtype=int)
    aligned = np.zeros((len(X), len(CLASS_NAMES)))
    aligned[:, classes] = probabilities
    return aligned


def metric_row(y, prediction, probabilities) -> tuple[dict, pd.DataFrame, np.ndarray]:
    return evaluate_predictions(y, prediction, probabilities, np.arange(len(CLASS_NAMES)))


def paired_noise_columns(summary: pd.DataFrame, folds: pd.DataFrame) -> pd.DataFrame:
    """Compare each feature set with the same model's V1 scores on identical folds."""
    rows = []
    for row in summary.itertuples(index=False):
        current = folds.query("feature_set == @row.feature_set and model == @row.model").sort_values("fold")
        baseline = folds.query("feature_set == 'V1' and model == @row.model").sort_values("fold")
        differences = current.macro_f1.to_numpy() - baseline.macro_f1.to_numpy()
        standard_error = float(differences.std(ddof=1) / np.sqrt(len(differences))) if len(differences) > 1 else 0.0
        gain = float(differences.mean())
        rows.append(
            {
                "feature_set": row.feature_set,
                "model": row.model,
                "cv_macro_f1_gain_vs_v1": gain,
                "paired_gain_standard_error": standard_error,
                "meaningful_gain_vs_v1": bool(gain >= max(0.01, standard_error)),
            }
        )
    return summary.merge(pd.DataFrame(rows), on=["feature_set", "model"])


def select_configuration(summary: pd.DataFrame) -> tuple[pd.Series, list[str]]:
    """Apply training-only non-inferiority gates, near-best bands, then simplicity."""
    baseline = summary.query("feature_set == 'V1'").set_index("model")
    candidates = summary.copy()
    keep = []
    for row in candidates.itertuples(index=False):
        reference = baseline.loc[row.model]
        keep.append(
            row.balanced_accuracy >= reference.balanced_accuracy - 0.02
            and row.ordinal_mae <= reference.ordinal_mae + 0.02
            and row.brier_score <= reference.brier_score + 0.02
            and row.worst_city_macro_f1 >= reference.worst_city_macro_f1 - 0.02
            and row.warm_recall >= reference.warm_recall - 0.02
            and row.warm_f1 >= reference.warm_f1 - 0.02
        )
    candidates = candidates[np.asarray(keep)]
    reasons = [
        "Compared only training OOF predictions from identical folds.",
        "Rejected configurations that materially degraded BA, MAE, Brier, worst-city F1, or Warm recall/F1 versus the same model's V1 (0.02 tolerance).",
    ]
    candidates = candidates[candidates.macro_f1 >= candidates.macro_f1.max() - 0.02]
    candidates = candidates[candidates.balanced_accuracy >= candidates.balanced_accuracy.max() - 0.02]
    candidates = candidates[candidates.ordinal_mae <= candidates.ordinal_mae.min() + 0.02]
    candidates = candidates[candidates.brier_score <= candidates.brier_score.min() + 0.02]
    candidates = candidates[candidates.worst_city_macro_f1 >= candidates.worst_city_macro_f1.max() - 0.02]
    candidates = candidates[candidates.warm_f1 >= candidates.warm_f1.max() - 0.02]
    candidates = candidates.assign(
        feature_complexity=candidates.feature_set.map(FEATURE_COMPLEXITY),
        model_complexity=candidates.model.map(MODEL_COMPLEXITY),
    ).sort_values(["feature_complexity", "model_complexity", "macro_f1"], ascending=[True, True, False])
    selected = candidates.iloc[0]
    if selected.feature_set != "V1" and not selected.meaningful_gain_vs_v1:
        selected = summary.query("feature_set == 'V1' and model == @selected.model").iloc[0]
        reasons.append("Engineered-feature gain was within paired fold noise, so the same model's V1 was retained.")
    else:
        reasons.append("Near-equal candidates were resolved in favour of the simplest feature set and model.")
    return selected, reasons


def save_training_outputs(
    summary: pd.DataFrame,
    folds: pd.DataFrame,
    per_class: pd.DataFrame,
    per_city: pd.DataFrame,
    oof: pd.DataFrame,
    matrices: dict,
):
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    summary.to_csv(RESULTS_DIR / "training_oof_summary.csv", index=False)
    folds.to_csv(RESULTS_DIR / "fold_metrics.csv", index=False)
    per_class.to_csv(RESULTS_DIR / "training_oof_per_class.csv", index=False)
    per_city.to_csv(RESULTS_DIR / "training_oof_per_city.csv", index=False)
    oof.to_csv(RESULTS_DIR / "training_oof_predictions.csv", index=False)
    matrix_dir = RESULTS_DIR / "confusion_matrices"
    matrix_dir.mkdir(exist_ok=True)
    for (feature_set, model), matrix in matrices.items():
        pd.DataFrame(matrix, index=CLASS_NAMES.values(), columns=CLASS_NAMES.values()).to_csv(
            matrix_dir / f"{feature_set}_{model}.csv"
        )


def save_plot(summary: pd.DataFrame):
    labels = summary.feature_set + "\n" + summary.model.str.replace("_", " ")
    x = np.arange(len(summary))
    fig, axis = plt.subplots(figsize=(13, 5), constrained_layout=True)
    axis.bar(x - 0.2, summary.macro_f1, width=0.4, label="OOF Macro F1", color="#2F6B5F")
    axis.bar(x + 0.2, summary.warm_f1, width=0.4, label="Warm F1", color="#E9A23B")
    axis.errorbar(x - 0.2, summary.macro_f1, yerr=summary.cv_macro_f1_std, fmt="none", ecolor="#173F36", capsize=3)
    axis.set(ylim=(0, 0.8), ylabel="Score", title="Training-only feature engineering comparison", xticks=x)
    axis.set_xticklabels(labels, rotation=45, ha="right")
    axis.legend()
    fig.savefig(RESULTS_DIR / "training_metric_comparison.png", dpi=180)
    plt.close(fig)


def run_feature_experiment(data_path: Path = DEFAULT_DATA):
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    df = load_data(data_path)
    train_index, test_index = split_data(df)
    split_table = pd.DataFrame(
        {
            "row_index": np.r_[train_index, test_index],
            "split": ["train"] * len(train_index) + ["test"] * len(test_index),
        }
    ).sort_values("row_index")
    split_table.to_csv(ARTIFACTS_DIR / "fixed_split_indices.csv", index=False)

    train = df.loc[train_index]
    X_train = train[FEATURES]
    y_train = train[TARGET].astype(int)
    strata = train[CITY].astype(str) + "__" + y_train.astype(str)
    cv = list(StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE).split(X_train, strata))

    summary_rows, fold_rows, class_rows, city_rows, prediction_frames = [], [], [], [], []
    matrices = {}
    for feature_set in FEATURE_SETS:
        for model_name, estimator in build_models().items():
            probabilities = np.zeros((len(train), len(CLASS_NAMES)))
            for fold, (fit_positions, validation_positions) in enumerate(cv, start=1):
                pipeline = make_feature_pipeline(feature_set, clone(estimator))
                pipeline.fit(X_train.iloc[fit_positions], y_train.iloc[fit_positions])
                fold_probabilities = aligned_probabilities(pipeline, X_train.iloc[validation_positions])
                probabilities[validation_positions] = fold_probabilities
                fold_prediction = np.argmax(fold_probabilities, axis=1)
                metrics, _, _ = metric_row(y_train.iloc[validation_positions], fold_prediction, fold_probabilities)
                fold_rows.append({"feature_set": feature_set, "model": model_name, "fold": fold, **metrics})

            prediction = np.argmax(probabilities, axis=1)
            metrics, report, matrix = metric_row(y_train, prediction, probabilities)
            matrices[(feature_set, model_name)] = matrix
            warm = report.loc[CLASS_NAMES[1]]
            city_metrics = {}
            for city in sorted(train[CITY].unique()):
                mask = train[CITY].to_numpy() == city
                values, _, _ = metric_row(y_train.to_numpy()[mask], prediction[mask], probabilities[mask])
                city_rows.append({"feature_set": feature_set, "model": model_name, "city": city, "n": int(mask.sum()), **values})
                city_metrics[city] = values["macro_f1"]
            summary_rows.append(
                {
                    "feature_set": feature_set,
                    "model": model_name,
                    **metrics,
                    "warsaw_macro_f1": city_metrics["Warsaw"],
                    "madrid_macro_f1": city_metrics["Madrid"],
                    "worst_city_macro_f1": min(city_metrics.values()),
                    "warm_recall": warm["recall"],
                    "warm_f1": warm["f1-score"],
                }
            )
            for class_name in CLASS_NAMES.values():
                class_rows.append(
                    {
                        "feature_set": feature_set,
                        "model": model_name,
                        "class_name": class_name,
                        **report.loc[class_name, ["precision", "recall", "f1-score", "support"]].to_dict(),
                    }
                )
            prediction_frames.append(
                pd.DataFrame(
                    {
                        "row_index": train.index,
                        "feature_set": feature_set,
                        "model": model_name,
                        "actual": y_train.to_numpy(),
                        "predicted": prediction,
                        "probability_ok": probabilities[:, 0],
                        "probability_warm": probabilities[:, 1],
                        "probability_too_hot": probabilities[:, 2],
                    }
                )
            )

    folds = pd.DataFrame(fold_rows)
    summary = pd.DataFrame(summary_rows)
    fold_aggregates = folds.groupby(["feature_set", "model"]).agg(
        cv_macro_f1_mean=("macro_f1", "mean"),
        cv_macro_f1_std=("macro_f1", "std"),
        cv_balanced_accuracy_mean=("balanced_accuracy", "mean"),
        cv_balanced_accuracy_std=("balanced_accuracy", "std"),
        cv_ordinal_mae_mean=("ordinal_mae", "mean"),
        cv_ordinal_mae_std=("ordinal_mae", "std"),
        cv_brier_mean=("brier_score", "mean"),
        cv_brier_std=("brier_score", "std"),
    ).reset_index()
    summary = summary.merge(fold_aggregates, on=["feature_set", "model"])
    summary = paired_noise_columns(summary, folds).sort_values(["feature_set", "model"])
    selected, reasons = select_configuration(summary)

    save_training_outputs(
        summary,
        folds,
        pd.DataFrame(class_rows),
        pd.DataFrame(city_rows),
        pd.concat(prediction_frames, ignore_index=True),
        matrices,
    )
    save_plot(summary)

    # The test rows are first read here, after feature-set/model selection is locked.
    test = df.loc[test_index]
    X_test = test[FEATURES]
    y_test = test[TARGET].astype(int)
    test_rows, test_class_rows, test_city_rows = [], [], []
    role = "selected_and_original_v1" if (selected.feature_set, selected.model) == ("V1", "random_forest") else "selected"
    selected_pipeline = make_feature_pipeline(selected.feature_set, clone(build_models()[selected.model]))
    selected_pipeline.fit(X_train, y_train)
    test_probabilities = aligned_probabilities(selected_pipeline, X_test)
    test_prediction = np.argmax(test_probabilities, axis=1)
    metrics, report, matrix = metric_row(y_test, test_prediction, test_probabilities)
    warm = report.loc[CLASS_NAMES[1]]
    city_f1 = {}
    for city in sorted(test[CITY].unique()):
        mask = test[CITY].to_numpy() == city
        values, _, _ = metric_row(y_test.to_numpy()[mask], test_prediction[mask], test_probabilities[mask])
        city_f1[city] = values["macro_f1"]
        test_city_rows.append({"role": role, "feature_set": selected.feature_set, "model": selected.model, "city": city, "n": int(mask.sum()), **values})
    test_rows.append(
        {
            "role": role,
            "feature_set": selected.feature_set,
            "model": selected.model,
            **metrics,
            "warsaw_macro_f1": city_f1["Warsaw"],
            "madrid_macro_f1": city_f1["Madrid"],
            "worst_city_macro_f1": min(city_f1.values()),
            "warm_recall": warm["recall"],
            "warm_f1": warm["f1-score"],
        }
    )
    for class_name in CLASS_NAMES.values():
        test_class_rows.append({"role": role, "feature_set": selected.feature_set, "model": selected.model, "class_name": class_name, **report.loc[class_name, ["precision", "recall", "f1-score", "support"]].to_dict()})
    pd.DataFrame(matrix, index=CLASS_NAMES.values(), columns=CLASS_NAMES.values()).to_csv(
        RESULTS_DIR / f"test_confusion_matrix_{role}.csv"
    )

    # Preserve the already-recorded V1 RF reference instead of testing it again.
    if role == "selected":
        original = pd.read_csv(ROOT / "results" / "model_comparison.csv").set_index("model").loc["random_forest"]
        original_report = pd.read_csv(ROOT / "results" / "random_forest_classification_report.csv").set_index("class_name")
        original_city = pd.read_csv(ROOT / "results" / "per_city_evaluation.csv").query("model == 'random_forest'")
        original_city_f1 = original_city.set_index("city").macro_f1.to_dict()
        original_warm = original_report.loc[CLASS_NAMES[1]]
        reference_role = "original_v1_reference_existing"
        test_rows.append(
            {
                "role": reference_role,
                "feature_set": "V1",
                "model": "random_forest",
                "macro_f1": original.macro_f1,
                "balanced_accuracy": original.balanced_accuracy,
                "ordinal_mae": original.ordinal_mae,
                "brier_score": original.brier_score,
                "warsaw_macro_f1": original_city_f1["Warsaw"],
                "madrid_macro_f1": original_city_f1["Madrid"],
                "worst_city_macro_f1": original.worst_city_macro_f1,
                "warm_recall": original_warm.recall,
                "warm_f1": original_warm["f1-score"],
            }
        )
        for class_name in CLASS_NAMES.values():
            values = original_report.loc[class_name]
            test_class_rows.append({"role": reference_role, "feature_set": "V1", "model": "random_forest", "class_name": class_name, **values[["precision", "recall", "f1-score", "support"]].to_dict()})
        for city, values in original_city.set_index("city").iterrows():
            test_city_rows.append({"role": reference_role, "feature_set": "V1", "model": "random_forest", "city": city, **values[["n", "macro_f1", "balanced_accuracy", "ordinal_mae", "brier_score"]].to_dict()})

    test_results = pd.DataFrame(test_rows)
    test_results.to_csv(RESULTS_DIR / "locked_test_comparison.csv", index=False)
    pd.DataFrame(test_class_rows).to_csv(RESULTS_DIR / "locked_test_per_class.csv", index=False)
    pd.DataFrame(test_city_rows).to_csv(RESULTS_DIR / "locked_test_per_city.csv", index=False)
    joblib.dump(selected_pipeline, ARTIFACTS_DIR / "selected_feature_model.joblib")

    metadata = {
        "selected_feature_set": selected.feature_set,
        "selected_model": selected.model,
        "selection_reasons": reasons,
        "selection_used_test_data": False,
        "features": list(FEATURE_NAMES[selected.feature_set]),
        "raw_production_inputs": FEATURES,
        "target": TARGET,
        "classes": CLASS_NAMES,
        "random_state": RANDOM_STATE,
        "train_rows": len(train),
        "test_rows": len(test),
        "dataset_sha256": hashlib.sha256(data_path.read_bytes()).hexdigest(),
        "v5_formula": "AT(C) = T + 0.33*e - 4.0; e(hPa) = RH/100 * 6.105 * exp(17.27*T/(237.7+T)); still-air assumption (wind=0 m/s)",
        "scope": "Population thermal-sensation model only; not personal calibration or medical risk prediction.",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    (ARTIFACTS_DIR / "experiment_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    (RESULTS_DIR / "selection.json").write_text(
        json.dumps({"selected_feature_set": selected.feature_set, "selected_model": selected.model, "reasons": reasons}, indent=2),
        encoding="utf-8",
    )
    return summary, test_results, metadata


if __name__ == "__main__":
    training_summary, test_summary, experiment_metadata = run_feature_experiment()
    columns = ["feature_set", "model", "macro_f1", "balanced_accuracy", "ordinal_mae", "brier_score", "worst_city_macro_f1", "warm_recall", "warm_f1"]
    print(training_summary[columns].to_string(index=False))
    print(f"\nSelected: {experiment_metadata['selected_feature_set']} + {experiment_metadata['selected_model']}")
    print(test_summary.to_string(index=False))
