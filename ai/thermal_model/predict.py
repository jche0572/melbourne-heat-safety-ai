# Import Path so we can build file paths safely.
from pathlib import Path

# joblib is used to load the saved trained model file.
import joblib

# pandas is used to create the input table required by the model.
import pandas as pd


# Get the folder where this predict.py file is located.
BASE_DIR = Path(__file__).resolve().parent

# Build the full path to the selected Experiment 5 model artifact.
MODEL_PATH = (
    BASE_DIR
    / "artifacts"
    / "experiment_5_historical_weather"
    / "selected_model.joblib"
)


# Load the saved Experiment 5 artifact once.
# Loading it once avoids reloading the model for every prediction.
artifact = joblib.load(MODEL_PATH)

# Extract the trained model from the saved artifact.
model = artifact["model"]

# Extract the feature names expected by the model.
features = artifact["features"]

# Extract the mapping between class numbers and class names.
class_names = artifact["class_names"]


# Define the function used by app.py to make a thermal prediction.
def predict_thermal_sensation(
    temperature_c,
    relative_humidity,
    wind_speed_10m_ms,
    shortwave_radiation_wm2,
):
    """
    Predict thermal sensation using Experiment 5.

    Returns:
        {
            "predicted_class": 0,
            "predicted_label": "Not warm / OK",
            "probabilities": {
                "Not warm / OK": 0.72,
                "Warm": 0.22,
                "Too hot": 0.06
            }
        }
    """

    # Convert the four weather inputs into a one-row pandas DataFrame.
    # The trained model expects input in table/DataFrame format.
    input_data = pd.DataFrame(
        [
            {
                "temperature_c": temperature_c,
                "relative_humidity": relative_humidity,
                "wind_speed_10m_ms": wind_speed_10m_ms,
                "shortwave_radiation_wm2": shortwave_radiation_wm2,
            }
        ],

        # Force the columns into the same order used during model training.
        columns=features,
    )

    # Ask the model to predict the thermal sensation class.
    # model.predict() returns an array, so [0] gets the first prediction.
    # int() converts the result into a normal Python integer.
    predicted_class = int(model.predict(input_data)[0])

    # Ask the model for the probability of each thermal sensation class.
    # Again, [0] gets the probabilities for the first input row.
    probabilities_raw = model.predict_proba(input_data)[0]

    # Convert the raw probability array into a readable dictionary.
    #
    # Example:
    # {
    #     "Not warm / OK": 0.72,
    #     "Warm": 0.22,
    #     "Too hot": 0.06
    # }
    probabilities = {
        class_names[int(class_value)]: float(probability)
        for class_value, probability in zip(
            model.classes_,
            probabilities_raw,
        )
    }

    # Return the final prediction result.
    return {
        "predicted_class": predicted_class,

        # Convert the predicted class number into its readable label.
        "predicted_label": class_names[predicted_class],

        # Return the probability for every class.
        "probabilities": probabilities,
    }


# This section only runs when predict.py is executed directly.
#
# Example:
# python predict.py
#
# It does not run when predict.py is imported by app.py.
if __name__ == "__main__":

    # Run one example prediction for testing.
    result = predict_thermal_sensation(
        temperature_c=16.1,
        relative_humidity=65,
        wind_speed_10m_ms=5.97,
        shortwave_radiation_wm2=565,
    )

    # Print the test prediction in the terminal.
    print(result)