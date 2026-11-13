# 🐾 Huellitas en Casa — Portal de adopción en Solana

**Ruta elegida:** Proyecto propio (temática: adopción de perros y gatos).
**Autora:** Mariana Dávila Méndez · **Correo de registro:** _<pon aquí el correo que usaste en el registro>_
**Program ID (Devnet):** `<PEGA_AQUI_TU_PROGRAM_ID>`
**Demo (60–90 s):** `<PEGA_AQUI_EL_ENLACE>`

## Propósito

Un refugio registra mascotas on-chain; cualquier persona con wallet puede solicitar adoptar una; solo el refugio aprueba o rechaza. Al aprobar, la mascota queda adoptada y vinculada al adoptante. El programa aplica las reglas de autoridad, pertenencia y cierre de cuentas; el frontend solo las consume.

## Equivalencia con los casos de "Pruebas y evidencias"

| Caso del bootcamp | En este proyecto | Instrucción |
|---|---|---|
| Registro | Refugio (PDA `["refugio", autoridad]`) | `crear_refugio` |
| Cliente | Mascota (PDA `["mascota", refugio, id]`) | `registrar_mascota`, `actualizar_mascota` |
| Venta | Solicitud de adopción (PDA `["solicitud", mascota, adoptante]`) | `solicitar_adopcion`, `resolver_solicitud` |
| Baja / cierre condicionado | Baja de mascota y cierre de solicitud | `dar_de_baja_mascota`, `cerrar_solicitud` |

## Reglas críticas aplicadas en el programa (Rust)

- **Autoridad:** solo la autoridad del refugio registra, edita, resuelve solicitudes y da de baja (`has_one = autoridad` + PDA derivada de la autoridad).
- **Pertenencia:** la mascota debe pertenecer al refugio y la solicitud a la mascota (`has_one`).
- **Cierre condicionado 1:** una mascota solo se da de baja si `solicitudes_pendientes == 0` (`TieneSolicitudesPendientes`).
- **Cierre condicionado 2:** el adoptante solo cierra su solicitud si ya fue resuelta, y recupera la renta (`SolicitudPendiente`).
- **Estado:** no se puede solicitar ni aprobar sobre una mascota ya adoptada; una solicitud no se resuelve dos veces.
- Una PDA por (mascota, adoptante) impide solicitudes duplicadas; el contador de ids del refugio no retrocede, así los ids nunca se reutilizan.

## Estructura

```
programs/adopcion/src/lib.rs   programa Anchor
tests/adopcion.ts              pruebas (válidos y rechazos)
frontend/                      React + Vite + wallet adapter
target/idl/adopcion.json       IDL (se genera con anchor build)
```

## Configuración y ejecución

Requisitos: Rust, Solana CLI, Anchor 0.30.1, Node 18+, Yarn, una wallet en Devnet (Phantom/Solflare).

```bash
yarn install
anchor keys sync          # genera/actualiza tu Program ID en lib.rs y Anchor.toml
anchor build              # compila y genera el IDL
anchor test               # pruebas en validador local

# Despliegue en Devnet
solana config set --url devnet
solana airdrop 2          # repite si hace falta
anchor deploy --provider.cluster devnet

# Frontend
yarn sync-idl             # copia el IDL a frontend/src/idl/
cd frontend && npm install && npm run dev
```

Pon tu wallet en **Devnet**, conéctala en la app y sigue el flujo: crear refugio → registrar mascota → (con otra wallet) solicitar adopción → aprobar → cerrar solicitud → dar de baja.

## Pruebas y evidencias

Ejecuta `anchor test`. Cubre:

| ID | Caso | Resultado esperado |
|---|---|---|
| V1–V4 | Crear refugio, registrar mascotas, modificar, solicitar | Cuentas creadas y datos leídos correctos |
| V5 | Aprobar solicitud | Mascota `Adoptada`, adoptante guardado |
| V6 | Rechazar y cerrar solicitud resuelta | Cuenta cerrada, renta devuelta |
| V7 | Baja de mascota sin pendientes | Cuenta cerrada, `mascotas_activas` baja |
| R1 | Editar sin ser autoridad | Rechazado |
| R2 | Baja con solicitudes pendientes | `TieneSolicitudesPendientes` |
| R3 | Cerrar solicitud pendiente | `SolicitudPendiente` |
| R4 | Intruso resuelve solicitud | Rechazado |
| R5 | Solicitar mascota ya adoptada | `MascotaNoDisponible` |
| R6 | Resolver dos veces | `SolicitudYaResuelta` |

**Transacciones verificables en Devnet:** _pega aquí al menos una firma y su enlace del Explorer_
(`https://explorer.solana.com/tx/<FIRMA>?cluster=devnet`). El frontend muestra el enlace después de cada operación.

## Plantilla de partida y aporte propio

Proyecto construido desde cero con Anchor 0.30.1 y el wallet adapter de Solana; no parte de la versión resuelta del proyecto guiado. El aporte es el dominio completo de adopción: modelo de tres cuentas relacionadas, flujo de solicitud/aprobación y las dos reglas de cierre descritas arriba. Se usó IA como apoyo para el desarrollo; todo el código fue revisado y probado.
