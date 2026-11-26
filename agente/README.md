# 🤖 Agente de consulta — Huellitas en Casa

Asistente que responde **preguntas en lenguaje natural desde la terminal** sobre el estado del portal de adopción, leyendo las cuentas del programa en **Solana Devnet** (`Refugio`, `Mascota`, `Solicitud`).

Es una forma adicional de consultar las mismas cuentas que muestra el frontend. **No modifica el programa, el frontend ni las pruebas originales**: vive aislado en esta carpeta.

## Cómo funciona

```
Pregunta ──▶ Modelo (LM Studio) ──pide──▶ TOOL resumen_adopciones
                  ▲                              │
                  │                       ACTION: lee cuentas por RPC
                  │                       y CALCULA el resumen (código)
                  └──────── respuesta ◀──────────┘
```

- **Los números los calcula el código, no el modelo.** El modelo solo redacta la respuesta con el resultado de la herramienta (temperatura 0).
- Cada plugin tiene su par **tool + action**: `src/plugins/adopcion/tools/resumenAdopcion.ts` (qué ofrece al modelo) y `src/plugins/adopcion/actions/resumenAdopcion.ts` (qué ejecuta).
- `calculo.ts` es una función pura y probada: mascotas por estado y especie, solicitudes por estado, tasa de adopción, detalle por mascota y **verificación de consistencia** entre los contadores del programa y las cuentas reales.
- **Solo lectura y sin llaves:** usa una wallet efímera sin fondos que nunca firma. No hay que poner ninguna llave privada en el `.env`.

## Requisitos

- Node 20 o superior.
- [LM Studio](https://lmstudio.ai/) con un modelo que tenga la capacidad **Tool use**, y su servidor local activo (*Developer → Start Server*, puerto 1234).
- El programa desplegado en Devnet (Program ID en el README principal). El agente reutiliza el IDL de `frontend/src/idl/adopcion.json`.

## Uso

```bash
cd agente
npm install
cp .env.example .env        # en Windows: copy .env.example .env

npm run resumen             # resumen calculado SIN modelo (no requiere LM Studio)
npm run resumen -- --json   # el mismo resumen en JSON
npm start                   # asistente interactivo con LM Studio
npm start -- --pregunta "¿Cuántas mascotas están disponibles?"
```

> LM Studio corre en tu computadora (`localhost`). Para usar el asistente con el modelo ejecuta el agente **en la misma computadora** (clona el repo y usa `npm start`). `npm run resumen` sí funciona en cualquier entorno, incluido Codespaces, porque solo necesita el RPC de Devnet.

Ejemplos de preguntas:

- ¿Cuántas mascotas hay disponibles para adopción?
- ¿Hay solicitudes pendientes? ¿De qué mascotas?
- ¿Cuál es la tasa de adopción del refugio?
- ¿Los contadores del programa coinciden con las cuentas?

## Pruebas

```bash
cd agente && npm test
```

9 pruebas automáticas (sin red real):

| Prueba | Qué comprueba |
|---|---|
| Cálculo de cifras | Estados, especies, edad promedio, solicitudes y tasa de adopción |
| Inconsistencias | Detecta contadores que no coinciden con las cuentas |
| Sin datos / refugio inexistente | Mensajes claros y tasa nula |
| Filtro por refugio | Por PDA o por autoridad |
| Action por RPC | Lee `Refugio`, `Mascota` y `Solicitud` codificadas según el IDL y calcula el resumen |
| Ciclo del agente | Pregunta → el modelo pide la tool → el código la ejecuta → respuesta; verifica `temperature: 0` y que el prompt declare solo lectura |
| LM Studio apagado | Error claro que sugiere `npm run resumen` |
| CLI `--sin-modelo` | Imprime el resumen calculado desde la terminal |

El RPC y el modelo de las pruebas son simulados; la verificación contra Devnet real se hace con `npm run resumen`.

## Aporte funcional

Nueva operación de consulta integrada al negocio (lectura en lenguaje natural) con una **validación de integridad** que el frontend no ofrece: compara `mascotas_activas` y `solicitudes_pendientes` declarados por el programa contra las cuentas realmente existentes. Se comprueba con `npm test` y con `npm run resumen` sobre Devnet.
