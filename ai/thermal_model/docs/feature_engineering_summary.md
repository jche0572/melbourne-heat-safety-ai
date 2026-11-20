# Feature engineering experiment summary

## Scope and protocol

This experiment remains a population thermal-sensation model. It predicts `OK`, `Warm`, or `Too hot`; it does not predict medical risk and does not include personal calibration.

- Raw model inputs: `temperature_c`, `relative_humidity` only.
- Evaluation metadata only: `city`.
- Fixed split: the existing city-and-class-stratified 551/138 split with `random_state=42`.
- Selection evidence: five-fold training OOF predictions only, using identical folds for all configurations.
- Held-out test: read only after `V4 + ordinal_logistic` was locked.
- RF and XGBoost reuse the existing training-selected parameters; no new hyperparameter search was run.

## Feature sets

| Version | Features |
|---|---|
| V1 | Raw temperature and relative humidity |
| V2 | V1, standardised within each training fold |
| V3 | Temperature, humidity, temperature squared, humidity squared; standardised within fold |
| V4 | V3 plus temperature x humidity; standardised within fold |
| V5 | V4 plus still-air Steadman apparent temperature; standardised within fold |

V5 uses `AT (C) = T + 0.33e - 4.0`, where `e (hPa) = RH/100 x 6.105 x exp(17.27T / (237.7 + T))`. Omitting the wind term assumes still air (`0 m/s`). This is an experimental temperature-humidity representation, not a medical heat-risk measure.

## Training-only OOF comparison

| Feature set | Model | Macro F1 | Balanced accuracy | Ordinal MAE | Brier | Warsaw F1 | Madrid F1 | Worst-city F1 | Warm recall | Warm F1 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| V1 | Ordinal logistic | 0.619 | 0.618 | 0.414 | 0.475 | 0.594 | 0.538 | 0.538 | 0.484 | 0.481 |
| V2 | Ordinal logistic | 0.619 | 0.618 | 0.414 | 0.475 | 0.594 | 0.538 | 0.538 | 0.484 | 0.481 |
| V3 | Ordinal logistic | 0.628 | 0.627 | 0.408 | 0.477 | 0.611 | 0.536 | 0.536 | 0.505 | 0.501 |
| **V4** | **Ordinal logistic** | **0.631** | **0.629** | **0.401** | **0.478** | **0.616** | **0.538** | **0.538** | **0.527** | **0.509** |
| V5 | Ordinal logistic | 0.634 | 0.631 | 0.399 | 0.476 | 0.611 | 0.552 | 0.552 | 0.565 | 0.528 |
| V1 | Random forest | 0.623 | 0.625 | 0.419 | 0.490 | 0.549 | 0.562 | 0.549 | 0.495 | 0.499 |
| V2 | Random forest | 0.626 | 0.626 | 0.419 | 0.490 | 0.555 | 0.560 | 0.555 | 0.505 | 0.507 |
| V3 | Random forest | 0.612 | 0.613 | 0.434 | 0.502 | 0.531 | 0.566 | 0.531 | 0.473 | 0.482 |
| V4 | Random forest | 0.628 | 0.630 | 0.417 | 0.494 | 0.556 | 0.573 | 0.556 | 0.495 | 0.506 |
| V5 | Random forest | 0.617 | 0.619 | 0.425 | 0.493 | 0.553 | 0.552 | 0.552 | 0.478 | 0.486 |
| V1 | XGBoost | 0.625 | 0.625 | 0.432 | 0.531 | 0.566 | 0.587 | 0.566 | 0.516 | 0.522 |
| V2 | XGBoost | 0.625 | 0.625 | 0.432 | 0.531 | 0.566 | 0.587 | 0.566 | 0.516 | 0.522 |
| V3 | XGBoost | 0.625 | 0.625 | 0.432 | 0.531 | 0.566 | 0.587 | 0.566 | 0.516 | 0.522 |
| V4 | XGBoost | 0.604 | 0.610 | 0.452 | 0.526 | 0.566 | 0.535 | 0.535 | 0.435 | 0.472 |
| V5 | XGBoost | 0.586 | 0.589 | 0.472 | 0.536 | 0.538 | 0.541 | 0.538 | 0.435 | 0.455 |

Full-precision results, fold mean and standard deviation, per-class metrics, per-city metrics, confusion matrices, and row-level OOF probabilities are stored under `results/feature_engineering/`.

## Selection decision

`V4 + ordinal_logistic` was selected from training data only.

Against V1 with the same model, V4 changed OOF metrics as follows:

- Macro F1: `+0.0125`.
- Balanced accuracy: `+0.0108`.
- Ordinal MAE: `-0.0127` (better).
- Brier: `+0.0034` (slightly worse).
- Worst-city Macro F1: `-0.0007` (effectively unchanged).
- Warm recall: `+0.0435`; Warm F1: `+0.0281`.

The paired five-fold Macro F1 gain was `0.0116` with a paired standard error of `0.0071`. This clears the predeclared 0.01 practical threshold and one paired standard error, but it is small relative to the approximately 0.055 fold-to-fold standard deviation. It is exploratory evidence, not strong statistical significance. V5 scored slightly higher overall, but its paired gain versus V1 (`0.0154`) was smaller than its paired standard error (`0.0169`) and it adds an assumed still-air formula, so the simpler V4 was preferred.

## Locked held-out test

| Configuration | Macro F1 | Balanced accuracy | Ordinal MAE | Brier | Warsaw F1 | Madrid F1 | Worst-city F1 | Warm recall | Warm F1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Original V1 Random Forest reference | 0.628 | 0.632 | 0.399 | 0.482 | 0.517 | 0.608 | 0.517 | 0.457 | 0.472 |
| Locked V4 Ordinal Logistic | 0.638 | 0.644 | 0.377 | 0.461 | 0.540 | 0.605 | 0.540 | 0.435 | 0.465 |

The locked configuration improved the held-out aggregate metrics and worst-city result, but **Warm performance did not improve on the test set**: recall fell by 0.022 and F1 fell by 0.007 versus the stored original V1 Random Forest reference. This result was reported without changing the selected configuration.

## Limitations and deployment trade-off

- Only 551 rows are available for training; five-fold variability is substantial.
- The held-out set had already been evaluated by the earlier population-model workflow, although it did not drive this feature-set selection. The new engineered configuration used training OOF evidence only before its one-time evaluation.
- V4 adds deterministic polynomial and interaction preprocessing, but uses the two existing runtime inputs and introduces no external data or new runtime dependency.
- The selected artifact is experimental and does not replace the existing population-model artifact.
