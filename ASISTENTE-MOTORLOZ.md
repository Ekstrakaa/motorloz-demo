# Operación del asistente MOTORLOZ

## Qué hace

El chat responde como recepción del taller en español rioplatense. Usa la API de OpenAI desde una función del servidor; la clave no se envía al navegador. Ayuda a describir el vehículo y el motivo de consulta y, si el cliente lo pide, prepara un mensaje para que la persona lo revise y envíe por WhatsApp. No confirma turnos, precios ni diagnósticos. La voz usa una llamada aparte de síntesis de audio; si falla, queda la respuesta escrita.

La conversación se conserva temporalmente en la pestaña del visitante. El sitio no guarda una agenda ni una base de clientes. La API puede conservar registros de seguridad según las políticas de OpenAI: no afirmar que el proveedor no retiene ningún dato. La web muestra un aviso para no compartir contraseñas, códigos ni datos de pago.

## Configuración

- `OPENAI_API_KEY`: clave privada de un proyecto del cliente, guardada solo en las variables del servidor de Vercel.
- `OPENAI_CHAT_MODEL`: por defecto `gpt-4.1-mini`.
- La voz se configura en `openai-narrator.cjs`. Revisar la vigencia del modelo de voz antes de renovaciones del servicio.

La facturación de la API es independiente de la suscripción ChatGPT. Activar alertas de consumo, un presupuesto de proyecto y recarga automática con límite acordado. Medir el gasto real de texto y voz durante el primer mes antes de ofrecer una cuota fija.

## Seguridad y mantenimiento

El servidor valida el formato, tamaño y origen de las solicitudes; limita consultas por IP dentro de cada instancia; no muestra la clave ni las instrucciones internas; y descarta respuestas que piden credenciales. Estas medidas reducen abuso, pero no garantizan que un endpoint público nunca reciba ataques. Configurar protección y límites de tráfico en el proveedor de hosting para el API, vigilar el consumo del proyecto y rotar la clave si se expone.

Para mejorar las respuestas, reunir ejemplos anonimizados aprobados por el taller, probar síntomas habituales y urgencias, y ajustar el prompt del servidor. Después de cualquier cambio, repetir las pruebas y confirmar que WhatsApp se abre con datos relatados por el visitante, sin inventar hechos.
