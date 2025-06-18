import json
import boto3
import os

IOT_ENDPOINT = "a2qtonmyilc0yl-ats.iot.us-east-2.amazonaws.com"

iot_data = boto3.client("iot-data", endpoint_url=f"https://{IOT_ENDPOINT}")

def lambda_handler(event, context):
    print("Evento recibido:", json.dumps(event))

    gas_state = event.get('gas_levels_state')
    thing_name = event.get('thing_name')

    if not gas_state or not thing_name:
        return {
            "statusCode": 400,
            "body": "Faltan campos necesarios (gas_level_state o thing_name)."
        }

    desired_state = {}

    if gas_state == "precaucion":
        desired_state["valve_state"] = "closed"

    elif gas_state in ["emergencia"]:
        desired_state["valve_state"] = "closed"
        desired_state["buzzer_state"] = "on"
        desired_state["fan_state"] = "on"

    if desired_state:
        response = iot_data.update_thing_shadow(
            thing_name=thing_name,
            payload=json.dumps({
                "state": {
                    "desired": desired_state
                }
            }).encode()
        )

        print("Shadow actualizado:", response)

        return {
            "statusCode": 200,
            "body": f"Actualización realizada para {thing_name}"
        }

    return {
        "statusCode": 204,
        "body": "No se aplicaron cambios"
    }