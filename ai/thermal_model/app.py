# Import Flask so we can create a small HTTP API.
# request is used to read JSON sent by the Node.js backend.
# jsonify converts Python dictionaries into JSON responses.
from flask import Flask, request, jsonify

# Import the thermal prediction function from predict.py.
# This function loads and uses the trained thermal model.
from predict import predict_thermal_sensation


# Create the Flask application.
app = Flask(__name__)


# ---------------------------------------------------------
# Health check endpoint
# ---------------------------------------------------------
# This endpoint can be used to check whether the thermal
# model API is currently running.
#
# Example:
# GET http://127.0.0.1:5001/
# ---------------------------------------------------------
@app.get("/")
def health_check():
    return jsonify(
        {
            "status": "ok",
            "service": "SolAdapt Thermal Model API",
        }
    )


# ---------------------------------------------------------
# Thermal prediction endpoint
# ---------------------------------------------------------
# The Node.js backend sends weather conditions to this
# endpoint.
#
# Example request:
#
# POST http://127.0.0.1:5001/predict
#
# {
#     "temperature_c": 25,
#     "relative_humidity": 60,
#     "wind_speed_10m_ms": 2.5,
#     "shortwave_radiation_wm2": 400
# }
#
# The endpoint validates the input and then sends the four
# weather variables to predict_thermal_sensation().
# ---------------------------------------------------------
@app.post("/predict")
def predict():
    try:
        # Read the JSON request body.
        # If the request body is empty or invalid JSON,
        # use an empty dictionary instead.
        data = request.get_json(silent=True) or {}

        # These are the four variables required by the
        # selected thermal sensation model.
        required_fields = [
            "temperature_c",
            "relative_humidity",
            "wind_speed_10m_ms",
            "shortwave_radiation_wm2",
        ]

        # Check whether any required fields are missing.
        missing_fields = [
            field
            for field in required_fields
            if field not in data
        ]

        # If any required field is missing, return HTTP 400.
        if missing_fields:
            return (
                jsonify(
                    {
                        "error": "Missing required fields",
                        "missing_fields": missing_fields,
                    }
                ),
                400,
            )

        try:
            # Convert each input to a float.
            # This makes sure the model receives numeric values.

            temperature_c = float(
                data["temperature_c"]
            )

            relative_humidity = float(
                data["relative_humidity"]
            )

            wind_speed_10m_ms = float(
                data["wind_speed_10m_ms"]
            )

            shortwave_radiation_wm2 = float(
                data["shortwave_radiation_wm2"]
            )

        # If any value cannot be converted to a number,
        # return HTTP 400.
        except (TypeError, ValueError):
            return (
                jsonify(
                    {
                        "error":
                            "All model input fields must be numeric."
                    }
                ),
                400,
            )

        # -------------------------------------------------
        # Input validation
        # -------------------------------------------------

        # Relative humidity must be between 0% and 100%.
        if not (0 <= relative_humidity <= 100):
            return (
                jsonify(
                    {
                        "error":
                            "relative_humidity must be between 0 and 100."
                    }
                ),
                400,
            )

        # Wind speed cannot be negative.
        if wind_speed_10m_ms < 0:
            return (
                jsonify(
                    {
                        "error":
                            "wind_speed_10m_ms cannot be negative."
                    }
                ),
                400,
            )

        # Shortwave radiation cannot be negative.
        if shortwave_radiation_wm2 < 0:
            return (
                jsonify(
                    {
                        "error":
                            "shortwave_radiation_wm2 cannot be negative."
                    }
                ),
                400,
            )

        # -------------------------------------------------
        # Run the thermal model
        # -------------------------------------------------
        # Send the four validated weather variables to
        # predict.py.
        #
        # predict_thermal_sensation() returns the predicted
        # thermal sensation class and class probabilities.
        #
        # Possible classes:
        # 0 = Not warm / OK
        # 1 = Warm
        # 2 = Too hot
        # -------------------------------------------------
        result = predict_thermal_sensation(
            temperature_c=temperature_c,
            relative_humidity=relative_humidity,
            wind_speed_10m_ms=wind_speed_10m_ms,
            shortwave_radiation_wm2=shortwave_radiation_wm2,
        )

        # -------------------------------------------------
        # Return prediction to the Node.js backend
        # -------------------------------------------------
        # The response contains:
        #
        # 1. The weather values received by the model.
        # 2. The model prediction returned by predict.py.
        # -------------------------------------------------
        return jsonify(
            {
                "input": {
                    "temperature_c":
                        temperature_c,

                    "relative_humidity":
                        relative_humidity,

                    "wind_speed_10m_ms":
                        wind_speed_10m_ms,

                    "shortwave_radiation_wm2":
                        shortwave_radiation_wm2,
                },

                "prediction": result,
            }
        )

    # -----------------------------------------------------
    # Unexpected server/model errors
    # -----------------------------------------------------
    # If something unexpected happens while making a
    # prediction, print the technical error on the server
    # and return a generic HTTP 500 response.
    # -----------------------------------------------------
    except Exception as error:
        print(
            "Thermal model prediction failed:",
            error,
        )

        return (
            jsonify(
                {
                    "error":
                        "Thermal model prediction failed."
                }
            ),
            500,
        )


# ---------------------------------------------------------
# Start the Flask server
# ---------------------------------------------------------
# This only runs when app.py is started directly:
#
# python app.py
#
# host="0.0.0.0"
# allows the service to listen on all network interfaces.
#
# port=5001
# is the port used by the Node.js backend to call the
# thermal model.
# ---------------------------------------------------------
if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5001,
        debug=True,
    )