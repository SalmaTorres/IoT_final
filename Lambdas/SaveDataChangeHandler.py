import json
import boto3
import time

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("GasEvents")
iot_data = boto3.client("iot-data", endpoint_url="https://a2qtonmyilc0yl-ats.iot.us-east-2.amazonaws.com")

def lambda_handler(event, context):
    print("Evento recibido:", json.dumps(event))

    thing_name = event.get("thingName")
    timestamp = event.get("timestamp") or int(time.time())

    if not thing_name:
        return {
            "statusCode": 400,
            "body": "Falta el thingName."
        }

    try:
        response = iot_data.get_thing_shadow(thing_name=thing_name)
        shadow = json.loads(response['payload'].read())
        reported = shadow.get('state', {}).get('reported', {})
        print("Shadow reportado:", json.dumps(reported))
    except Exception as e:
        print("Error al obtener el Shadow:", e)
        return {
            "statusCode": 500,
            "body": "Error al obtener el Shadow."
        }

    gas_state = reported.get("gas_level_state")
    gas_ppm = reported.get("gas_level_ppm")
    valve_state = reported.get("valve_state")
    fan_state = reported.get("fan_state")

    if not gas_state:
        return {
            "statusCode": 400,
            "body": "No se encontró el estado del gas."
        }

    table.put_item(
        Item={
            "thing_name": thing_name,
            "timestamp": timestamp,
            "gas_level_ppm": gas_ppm,
            "gas_level_state": gas_state,
            "valve_state": valve_state,
            "fan_state": fan_state
        }
    )

    print(" Datos guardados.")
    return {
        "statusCode": 200,
        "body": "Evento registrado."
    }