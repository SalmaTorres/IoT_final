const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');
const IotData = new AWS.IotData({ endpoint: 'a2qtonmyilc0yl-ats.iot.us-east-2.amazonaws.com' });
const dynamoDb = new AWS.DynamoDB.DocumentClient();

async function getThingNameFromDB(userId) {
    const params = {
        TableName: 'UsersDevices',
        Key: { userId }
    };

    try {
        const data = await dynamoDb.get(params).promise();
        if (data.Item && data.Item.devices && data.Item.devices.length > 0) {

            return data.Item.devices[0].thingName || data.Item.devices[0]; 
        } else {
            throw new Error("No se encontraron dispositivos.");
        }
    } catch (error) {
        console.error("Error obteniendo thingName:", error);
        throw error;
    }
}

function getUserDevices(userId) {
    const params = {
        TableName: 'UsersDevices',
        Key: {
            'userId': { S: user_id }
        }
    };

    return new Promise((resolve, reject) => {
        DynamoDB.getItem(params, (err, data) => {
            if (err) {
                console.error("Error al consultar DynamoDB:", err);
                reject(err);
            } else {
                if (data.Item && data.Item.devices && data.Item.devices.L) {
                    const devices = data.Item.devices.L.map(device => device.S);
                    resolve(devices);
                } else {
                    resolve([]);
                }
            }
        });
    });
}

function getShadowPromise(params) {
    return new Promise((resolve, reject) => {
        IotData.getThingShadow(params, (err, data) => {
            if (err) {
                console.log(err, err.stack);
                reject('Fallo obtencion de shadow ${err.errorMessage}');
            } else {
                resolve(JSON.parse(data.payload));
            }
        });
    });
}

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        const userId = handlerInput.requestEnvelope.context.System.user.userId;
        const params = {
            TableName: 'UsersDevices',
            Key: {
                user_id: userId
            }
        };

        try {
            const data = await dynamoDb.get(params).promise();
            if (!data.Item) {
                const speakOutput = 'Lo siento, no estás autorizado para usar esta skill.';
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .getResponse();
            }
        } catch (error) {
            console.error("Error al consultar la base de datos:", error);
            const speakOutput = 'Ocurrió un error al verificar tu acceso. Intenta más tarde.';
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
        }

        const speakOutput = '¡Bienvenido! ¿Qué deseas hacer?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿Qué deseas hacer?')
            .getResponse();
    }
};

const GetMyDevicesIntentHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
          && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetMyDevicesIntent';
    },
    async handle(handlerInput) {
      const userId = handlerInput.requestEnvelope.context.System.user.userId;
      console.log("userId:", userId);
  
      const params = {
        TableName: 'UsersDevices',
        Key: {
          user_id: userId
        }
      };
  
      let speakOutput = 'Hubo un problema al obtener tus dispositivos. Intenta más tarde.';
  
      try {
        const data = await dynamoDb.get(params).promise();
        if (data && data.Item && data.Item.devices && data.Item.devices.length > 0) {
          const dispositivos = data.Item.devices;
          speakOutput = `Tienes registrados los siguientes dispositivos: ${dispositivos.join(', ')}`;
        } else {
          speakOutput = 'No se encontraron dispositivos asociados a tu cuenta.';
        }
      } catch (error) {
        console.error("Error al consultar DynamoDB:", error);
      }
  
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt('¿Quieres hacer algo más?')
        .getResponse();
    }
};  

const OpenValveIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'OpenValveIntent';
    },
    async handle(handlerInput) {
        const userId = handlerInput.requestEnvelope.context.System.user.userId;
        const thingName = await getThingNameFromDB(userId);

        try {
            const shadowData = await getShadowPromise({ thingName });
            const state = shadowData.state.reported.gas_level_state;

            if (state === 'seguro' || state === 'precaución') {
                const params = {
                    thingName,
                    payload: JSON.stringify({
                        state: { desired: { valve_state: "open" } }
                    })
                };

                await IotData.updateThingShadow(params).promise();
                const speakOutput = 'La válvula se está abriendo.';
                return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput)
                .getResponse();
            } else {
                const speakOutput = `No se puede abrir la válvula porque el estado del gas es ${state}.`;
                return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput)
                .getResponse();
            }
        } catch (error) {
            console.error("Error al manejar OpenValveIntent:", error);
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput)
                .getResponse();
        }
    }
};

const CloseValveIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CloseValveIntent';
    },
    async handle(handlerInput) {
        const userId = handlerInput.requestEnvelope.context.System.user.userId;
        const thingName = await getThingNameFromDB(userId);

        try {
            const shadowData = await getShadowPromise({ thingName });
            const state = shadowData.state.reported.gas_level_state;

            if (state === 'seguro' || state === 'precaución') {
                const params = {
                    thingName,
                    payload: JSON.stringify({
                        state: { desired: { valve_state: "closed" } }
                    })
                };

                await IotData.updateThingShadow(params).promise();
                const speakOutput = 'La válvula se está cerrando.';
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt(speakOutput)
                    .getResponse();
            } else {
                const speakOutput = `No se puede cerrar la válvula porque el estado del gas es ${state}.`;
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt(speakOutput)
                    .getResponse();
            }
        } catch (error) {
            console.error("Error al manejar CloseValveIntent:", error);
            return handlerInput.responseBuilder
                .speak('Ocurrió un error al intentar cerrar la válvula.')
                .reprompt(speakOutput)
                .getResponse();
        }
    }
};

const TurnOnFanIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'TurnOnFanIntent';
    },
    async handle(handlerInput) {
        const userId = handlerInput.requestEnvelope.context.System.user.userId;
        const thingName = await getThingNameFromDB(userId);

        try {
            const shadowData = await getShadowPromise({ thingName });
            const state = shadowData.state.reported.gas_level_state;

            if (state === 'seguro' || state === 'precaución') {
                const params = {
                    thingName,
                    payload: JSON.stringify({
                        state: { desired: { fan_state: "on" } }
                    })
                };

                await IotData.updateThingShadow(params).promise();
                const speakOutput = 'El ventilador se está encendiendo.';
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt(speakOutput)
                    .getResponse();
            } else {
                const speakOutput = `No se puede encender el ventilador porque el estado del gas es ${state}.`;
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt(speakOutput)
                    .getResponse();
            }
        } catch (error) {
            console.error("Error al manejar TurnOnFanIntent:", error);
            return handlerInput.responseBuilder
                .speak('Ocurrió un error al intentar encender el ventilador.')
                .reprompt(speakOutput)
                .getResponse();
        }
    }
};

const TurnOffFanIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'TurnOffFanIntent';
    },
    async handle(handlerInput) {
        const userId = handlerInput.requestEnvelope.context.System.user.userId;
        const thingName = await getThingNameFromDB(userId);

        try {
            const shadowData = await getShadowPromise({ thingName });
            const state = shadowData.state.reported.gas_level_state;

            if (state === 'seguro' || state === 'precaución') {
                const params = {
                    thingName,
                    payload: JSON.stringify({
                        state: { desired: { fan_state: "off" } }
                    })
                };

                await IotData.updateThingShadow(params).promise();
                const speakOutput = 'El ventilador se está apagando.';
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt(speakOutput)
                    .getResponse();
            } else {
                const speakOutput = `No se puede apagar el ventilador porque el estado del gas es ${state}.`;
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt(speakOutput)
                    .getResponse();
            }
        } catch (error) {
            console.error("Error al manejar TurnOffFanIntent:", error);
            return handlerInput.responseBuilder
                .speak('Ocurrió un error al intentar apagar el ventilador.')
                .reprompt(speakOutput)
                .getResponse();
        }
    }
};

const GetValveStatusIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetValveStatusIntent';
    },
    async handle(handlerInput) {
        const userId = handlerInput.requestEnvelope.session.user.userId;
        const thingName = await getThingNameFromDB(userId);

        const params = { thingName };

        let speakOutput = 'Error';
        try {
            const result = await getShadowPromise(params);
            const valve_state = result.state.reported.valve_state;

            if (valve_state === "closed") {
                speakOutput = 'La válvula está cerrada';
            } else if (valve_state === "open") {
                speakOutput = 'La válvula está abierta';
            } else {
                speakOutput = 'No se pudo consultar el estado de la válvula, por favor intente más tarde';
            }
        } catch (err) {
            console.error(err);
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const GetFanStatusIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetFanStatusIntent';
    },
    async handle(handlerInput) {
        const userId = handlerInput.requestEnvelope.session.user.userId;
        const thingName = await getThingNameFromDB(userId);

        const params = { thingName };

        let speakOutput = 'Error';
        try {
            const result = await getShadowPromise(params);
            const fan_state = result.state.reported.fan_state;

            if (fan_state === "on") {
                speakOutput = 'El ventilador está encendido';
            } else if (fan_state === "off") {
                speakOutput = 'El ventilador está apagado';
            } else {
                speakOutput = 'No se pudo consultar el estado del ventilador, por favor intente más tarde';
            }
        } catch (err) {
            console.error(err);
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const GetGasIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetGasIntent';
    },
    async handle(handlerInput) {
        const userId = handlerInput.requestEnvelope.session.user.userId;
        const thingName = await getThingNameFromDB(userId);

        const params = { thingName };

        let speakOutput = 'Error';
        try {
            const result = await getShadowPromise(params);
            const gasLevel_ppm = result.state.reported.gas_level_ppm;
            const gasLevel_state = result.state.reported.gas_level_state;

            if (gasLevel_ppm !== undefined && gasLevel_ppm !== null) {
                speakOutput = `El ambien esta en estado ${gasLevel_state} con ${gasLevel_ppm} partes por millon detectado`;
            }
        } catch (error) {
            console.error("Error al consultar Shadow:", error);
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const SetSafeThresholdIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SetSafeThresholdIntent';
  },
  async handle(handlerInput) {
    const userId = handlerInput.requestEnvelope.context.System.user.userId;
    const safeValueRaw = Alexa.getSlotValue(handlerInput.requestEnvelope, 'valor');
    const safeValue = parseInt(safeValueRaw, 10);

    if (isNaN(safeValue) || safeValue <= 50 || safeValue >= 200) {
      const speakOutput = 'El umbral seguro debe estar entre 51 y 199 ppm. Por favor, dime un valor válido.';
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    }

    try {
      const thingName = await getThingNameFromDB(userId);

      const shadow = await IotData.getThingShadow({ thingName }).promise();
      const shadowState = JSON.parse(shadow.payload);
      const currentWarning = shadowState.state.desired?.warning_threshold || 1000;

      if (safeValue >= currentWarning) {
        const speakOutput = `El umbral seguro debe ser menor que el umbral de advertencia actual, que es ${currentWarning} ppm.`;
        return handlerInput.responseBuilder
          .speak(speakOutput)
          .reprompt(speakOutput)
          .getResponse();
      }

      const params = {
        thingName,
        payload: JSON.stringify({
          state: {
            desired: {
              safe_threshold: safeValue
            }
          }
        })
      };

      await IotData.updateThingShadow(params).promise();
      const speakOutput = `El umbral seguro fue actualizado a ${safeValue} ppm.`;
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();

    } catch (error) {
      console.error("Error al actualizar safe_threshold:", error);
      return handlerInput.responseBuilder
        .speak('Ocurrió un error al establecer el umbral seguro.')
        .reprompt('¿Quieres intentar nuevamente?')
        .getResponse();
    }
  }
};


const SetWarningThresholdIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SetWarningThresholdIntent';
  },
  async handle(handlerInput) {
    const userId = handlerInput.requestEnvelope.context.System.user.userId;
    const warningValueRaw = Alexa.getSlotValue(handlerInput.requestEnvelope, 'warningValue');
    const warningValue = parseInt(warningValueRaw, 10);

    if (isNaN(warningValue) || warningValue <= 150 || warningValue >= 1000) {
      const speakOutput = 'El umbral de advertencia debe estar entre 151 y 999 ppm. Por favor, dime un valor válido.';
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    }

    try {
      const thingName = await getThingNameFromDB(userId);

      const shadow = await IotData.getThingShadow({ thingName }).promise();
      const shadowState = JSON.parse(shadow.payload);
      const currentSafe = shadowState.state.desired?.safe_threshold || 50;

      if (warningValue <= currentSafe) {
        const speakOutput = `El umbral de advertencia debe ser mayor que el umbral seguro actual, que es ${currentSafe} ppm.`;
        return handlerInput.responseBuilder
          .speak(speakOutput)
          .reprompt(speakOutput)
          .getResponse();
      }

      const params = {
        thingName,
        payload: JSON.stringify({
          state: {
            desired: {
              warning_threshold: warningValue
            }
          }
        })
      };

      await IotData.updateThingShadow(params).promise();
      const speakOutput = `El umbral de advertencia fue actualizado a ${warningValue} ppm.`;
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();

    } catch (error) {
      console.error("Error al actualizar warning_threshold:", error);
      return handlerInput.responseBuilder
        .speak('Ocurrió un error al establecer el umbral de advertencia.')
        .reprompt('¿Quieres intentar nuevamente?')
        .getResponse();
    }
  }
};

const GetSafeThresholdIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetSafeThresholdIntent';
  },
  async handle(handlerInput) {
    const userId = handlerInput.requestEnvelope.context.System.user.userId;

    try {
      const thingName = await getThingNameFromDB(userId);
      const shadow = await IotData.getThingShadow({ thingName }).promise();
      const shadowState = JSON.parse(shadow.payload);
      const safeThreshold = shadowState.state.desired?.safe_threshold;

      let speakOutput = '';

      if (safeThreshold !== undefined) {
        speakOutput = `El umbral seguro actual es de ${safeThreshold} ppm.`;
      } else {
        speakOutput = 'No se ha establecido un umbral seguro aún.';
      }

      return handlerInput.responseBuilder
        .speak(speakOutput)
        .getResponse();

    } catch (error) {
      console.error("Error al obtener safe_threshold:", error);
      return handlerInput.responseBuilder
        .speak('Ocurrió un error al obtener el umbral seguro.')
        .reprompt('¿Quieres intentar nuevamente?')
        .getResponse();
    }
  }
};

const GetWarningThresholdIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetWarningThresholdIntent';
  },
  async handle(handlerInput) {
    const userId = handlerInput.requestEnvelope.context.System.user.userId;

    try {
      const thingName = await getThingNameFromDB(userId);
      const shadow = await IotData.getThingShadow({ thingName }).promise();
      const shadowState = JSON.parse(shadow.payload);
      const warningThreshold = shadowState.state.desired?.warning_threshold;

      let speakOutput = '';

      if (warningThreshold !== undefined) {
        speakOutput = `El umbral de advertencia actual es de ${warningThreshold} ppm.`;
      } else {
        speakOutput = 'No se ha establecido un umbral de advertencia aún.';
      }

      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt('¿Quieres intentar nuevamente?')
        .getResponse();

    } catch (error) {
      console.error("Error al obtener warning_threshold:", error);
      return handlerInput.responseBuilder
        .speak('Ocurrió un error al obtener el umbral de advertencia.')
        .reprompt('¿Quieres intentar nuevamente?')
        .getResponse();
    }
  }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Puedes decir encender el timbre, abrir la válvula o obtener el nivel de gas.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};


const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Hasta pronto!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Lo siento, no entendí, intenta de nuevo.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log('Sesion finalizada: ${JSON.stringify(handlerInput.requestEnvelope)}');
        return handlerInput.responseBuilder.getResponse(); 
    }
};

const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `Intentó ejecutar ${intentName}`;


        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};


const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log('Error handled (toString):', error.toString?.());
        console.log('Error handled (stack):', error.stack || 'no stack');
        console.log('Error handled (full):', error);
        console.log('Request Envelope:', JSON.stringify(handlerInput.requestEnvelope, null, 2));

        const speakOutput = 'Disculpa, hubo un error. Intenta de nuevo.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿Podrías repetirlo?')
            .getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        OpenValveIntentHandler,
        CloseValveIntentHandler,
        TurnOnFanIntentHandler,
        TurnOffFanIntentHandler,
        GetValveStatusIntentHandler,
        GetFanStatusIntentHandler,
        GetGasIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        GetMyDevicesIntentHandler,
        SessionEndedRequestHandler,
        SetSafeThresholdIntentHandler,
        SetWarningThresholdIntentHandler,
        GetSafeThresholdIntentHandler,
        GetWarningThresholdIntentHandler,
        IntentReflectorHandler)
    .addErrorHandlers(
        ErrorHandler)
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();