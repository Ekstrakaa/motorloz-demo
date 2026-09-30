# Guía breve del asistente MOTORLOZ

## Qué hace hoy

El chat usa `gemini-3.5-flash-lite` para conversar. Al preparar una consulta por fallas, ese modelo redacta una síntesis de **lo dicho por el cliente**; el cliente la puede corregir antes de abrir WhatsApp. Para servicios simples, como un cambio de aceite, la web arma una síntesis inmediata sin otra llamada a Gemini. La voz usa `gemini-3.8-flash-lite-tts`, con alternativas si el proveedor limita la voz. Una clave de API da acceso a los modelos, pero **no los entrena**.

El asistente es la recepción inicial: escucha, pregunta por el auto, los síntomas o el mantenimiento solicitado, y prepara el mensaje. No confirma turnos, horarios, precios ni diagnósticos. Puede explicar que Pablo, dueño del taller, o Bruno, del equipo, revisarán el caso, sin prometer su disponibilidad. WhatsApp es el último paso; el equipo del taller revisa la consulta y confirma la coordinación. El número del cliente no se pide en la web: WhatsApp identifica al remitente.

La invitación a preparar el WhatsApp aparece después de una conversación útil: el cliente mencionó el vehículo, explicó el problema o servicio en más de un intercambio y dio su nombre. Si le faltan datos exactos, puede dejar modelo, año o kilometraje aproximados; el taller los confirma después. El micrófono de la web transcribe en el navegador y envía texto, nunca una nota de voz.

## Cómo mejorar sus respuestas

1. Definir con el taller respuestas aprobadas: servicios reales, horarios, dirección, cómo reciben urgencias y qué promesas nunca deben hacerse.
2. Reunir ejemplos **sin nombres, teléfonos ni matrículas**: lo que preguntó un cliente y cómo respondería bien la recepción. Incluir casos simples, complejos y urgentes.
3. Ajustar las instrucciones de recepción en `SYSTEM_PROMPT`, dentro de `gemini-assistant.cjs`. La clave de API no se cambia para ajustar el estilo.
4. Probar conversaciones de varios mensajes, tanto por fallas como por mantenimiento: el asistente debe recordar marca, modelo, año, kilometraje, síntomas o servicio y cuándo comenzó el problema; debe preguntar solo lo que falta y no empujar un turno después de un saludo.
5. Revisar la síntesis final antes de abrir WhatsApp. Debe contener solamente hechos relatados por el cliente; el taller decide qué hacer y confirma el horario.

El chat conserva hasta 20 mensajes recientes como contexto para Gemini y recupera la conversación en la misma pestaña si se recarga. La web no tiene una agenda ni una base de clientes. La conversación no se envía al taller: solo llega el mensaje que la persona decide enviar por WhatsApp.

## Configuración técnica

- `GEMINI_API_KEY`: acceso privado a la API; nunca va en el navegador.
- `GEMINI_CHAT_MODEL`: modelo de conversación (por defecto `gemini-3.5-flash-lite`).
- `GEMINI_SUMMARY_MODEL`: modelo para la síntesis de recepción (por defecto `gemini-3.5-flash-lite`).
- `GEMINI_TTS_MODEL` y `GEMINI_TTS_VOICE`: modelo y voz de lectura.

Cambiar estas variables o las instrucciones requiere publicar una nueva versión y volver a probar el chat. El ajuste fino del modelo por la API de Gemini no está disponible actualmente; para este caso se mejora con instrucciones, ejemplos y pruebas. La disponibilidad gratuita depende de los cupos de Gemini: no garantiza voz continua ni tiempos de respuesta constantes. Si falla la voz de Gemini, la web intenta la voz del navegador, que puede variar entre teléfonos.
