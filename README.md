# 🐾 Huellitas en Casa — Portal de adopción en Solana

Proyecto final del bootcamp Solana (nivel Advanced) · **Ruta elegida: proyecto propio** (temática: adopción de perros y gatos).

| | |
|---|---|
| **Autora** | Mariana Dávila Méndez |
| **Correo de registro** | 24015868@es.uveg.edu.mx|
| **Program ID (Devnet)** | `ATvb4Msom2jT342BSdzFWzaepTPYxWdsrs1A1EacXUx` |
| **Ver programa en el Explorer** | https://explorer.solana.com/address/ATvb4Msom2jT342BSdzFWzaepTPYxWdsrs1A1EacXUx?cluster=devnet |
| **Repositorio** | https://github.com/24015868-bit/huellitas-adopcion-solana |
| **Demo (60–90 s)** | https://youtu.be/38M176HEa3w |

## Propósito

Un refugio registra mascotas on-chain; cualquier persona con wallet puede solicitar adoptar una; **solo el refugio aprueba o rechaza**. Al aprobar, la mascota queda como adoptada y vinculada al adoptante. El programa (Rust/Anchor) aplica las reglas de autoridad, pertenencia y cierre de cuentas; el frontend solo las consume y muestra los errores del programa.

## Equivalencia con los casos de "Pruebas y evidencias"

Este proyecto no usa los nombres Registro, Cliente y Venta; estas son las operaciones equivalentes:

| Caso del bootcamp | En este proyecto | Instrucciones |
|---|---|---|
| Registro | Refugio (PDA `["refugio", autoridad]`) | `crear_refugio` |
| Cliente | Mascota (PDA `["mascota", refugio, id]`) | `registrar_mascota`, `actualizar_mascota` |
| Venta | Solicitud de adopción (PDA `["solicitud", mascota, adoptante]`) | `solicitar_adopcion`, `resolver_solicitud` |
| Baja / cierre condicionado | Baja de mascota y cierre de solicitud | `dar_de_baja_mascota`, `cerrar_solicitud` |

Cubre: **creación, lectura y modificación** de cuentas, **permisos** por autoridad y **cierre de cuentas condicionado** por una regla del programa.

## Reglas críticas aplicadas en el programa

- **Autoridad:** solo la autoridad del refugio registra, edita, resuelve solicitudes y da de baja (`has_one = autoridad` + PDA derivada de la autoridad).
- **Pertenencia:** la mascota debe pertenecer al refugio y la solicitud a la mascota (`has_one`).
- **Cierre condicionado 1:** una mascota solo se da de baja si `solicitudes_pendientes == 0` (error `TieneSolicitudesPendientes`).
- **Cierre condicionado 2:** el adoptante solo cierra su solicitud si ya fue resuelta, y recupera la renta (error `SolicitudPendiente`).
- **Estado:** no se puede solicitar ni aprobar sobre una mascota ya adoptada, y una solicitud no se resuelve dos veces.
- Una PDA por (mascota, adoptante) impide solicitudes duplicadas. El contador de ids del refugio nunca retrocede, así los ids no se reutilizan.

## Estructura

```
programs/adopcion/src/lib.rs   programa Anchor (Rust)
tests/adopcion.ts              pruebas: casos válidos y de rechazo
generar_idl.py                 genera el IDL desde lib.rs (ver nota abajo)
frontend/                      React + Vite + wallet adapter (Phantom/Solflare)
frontend/src/idl/              IDL y tipos usados por el cliente
```

## Configuración y ejecución

**Versiones usadas:** Anchor 0.30.1, Solana CLI 1.18.26, Rust (cargo) estable, Node 18+, Yarn. Wallet en **Devnet** (Phantom o Solflare).

```bash
yarn install
anchor keys sync                 # alinea el Program ID en lib.rs y Anchor.toml
anchor build --no-idl            # compila el programa
python3 generar_idl.py           # genera target/idl, target/types y frontend/src/idl
anchor test --skip-build         # pruebas en validador local (esperado: 13 passing)

# Despliegue en Devnet
solana config set --url devnet
solana airdrop 2                 # o https://faucet.solana.com si hay límite
anchor deploy --provider.cluster devnet

# Frontend
cd frontend && npm install && npm run dev      # abre http://localhost:5173
```

> **Nota sobre el IDL:** `anchor idl build` (Anchor 0.30.1) falla con la versión de Rust del entorno por una incompatibilidad de la librería `ark-bn254`. Por eso `generar_idl.py` deriva el IDL directamente de `lib.rs` (mismas instrucciones, cuentas, tipos y errores) y comprueba que cada instrucción exista en el programa. `Cargo.lock` fija `proc-macro2 1.0.94` por la misma razón.

**Uso de la app:** conecta tu wallet en Devnet → *Crear refugio* → *Registrar mascota* → con **otra** wallet, *Quiero adoptar* → con la wallet del refugio, *Aprobar* o *Rechazar* → el adoptante usa *Cerrar y recuperar renta* → el refugio usa *Dar de baja*. Si Devnet tarda en confirmar, la app sigue esperando la firma (hasta 60 s) y después muestra el enlace a la transacción.

## Pruebas y evidencias

### Pruebas automáticas (`anchor test --skip-build` → 13 passing)

| ID | Caso | Resultado observado |
|---|---|---|
| V1 | Crear refugio | Cuenta creada, datos leídos correctos |
| V2 | Registrar dos mascotas (PDAs distintas) | Contadores del refugio actualizados |
| V3 | Modificar una mascota | Nombre y edad actualizados |
| V4 | Solicitar adopción | Solicitud `Pendiente`, mascota con 1 pendiente |
| V5 | Aprobar solicitud | Mascota `Adoptada`, adoptante guardado |
| V6 | Rechazar y cerrar solicitud resuelta | Cuenta cerrada, renta devuelta |
| V7 | Dar de baja mascota sin pendientes | Cuenta cerrada, `mascotas_activas` baja |
| R1 | Editar sin ser autoridad | Rechazado |
| R2 | Dar de baja con solicitudes pendientes | `TieneSolicitudesPendientes` |
| R3 | Cerrar una solicitud pendiente | `SolicitudPendiente` |
| R4 | Intruso resuelve una solicitud | Rechazado |
| R5 | Solicitar una mascota ya adoptada | `MascotaNoDisponible` |
| R6 | Resolver dos veces la misma solicitud | `SolicitudYaResuelta` |

### Transacciones verificables en Devnet (flujo real desde el frontend)

| # | Operación | Wallet | Transacción |
|---|---|---|---|
| 1 | Crear refugio | Refugio | [Ver en Explorer](https://explorer.solana.com/tx/4hy2HTczZnNMBTtmhX4DtbVMkhqd6JpMTN9mbUWejAqLjb3hh1wPtGJ9eiK2pgHmi1TMFPhnpaxt8aFGmq17FYYP?cluster=devnet) |
| 2 | Registrar mascota "Luna" | Refugio | [Ver en Explorer](https://explorer.solana.com/tx/4d7MdH85gzb3X18ZzYYQAopbybEXkr3ar3Y1ExVZWNBcMj5f8vLmqVV4fpfnz7CxXHDcsaFyaApVdjF7LXD1r8kk?cluster=devnet) |
| 3 | Solicitar adopción de "Luna" | Adoptante | [Ver en Explorer](https://explorer.solana.com/tx/4s1Fus7dfyDYXHJGro5Vok29TcV27Legka8RrJfVj82h4tjLKkieEFoUUrzA66ZDGYb6rkisPiRPaZygt2FH1Xrx?cluster=devnet) |
| 4 | Aprobar la solicitud | Refugio | [Ver en Explorer](https://explorer.solana.com/tx/3mqhvSZYxtibsaTYe2FEsFP4NPBx7fv86uST3m3HTEWyj1bZxvdAdx6DcUPBzepjADepRPWBc3BBpHAHrkcniNSJ?cluster=devnet) |
| 5 | Cerrar solicitud y recuperar renta | Adoptante | [Ver en Explorer](https://explorer.solana.com/tx/24aU5QWK7XZ7ph2jpZBMzpcS8TAa3VGwwVa61d7fAHYDAtyCC5rNCd2iVdj8Kwj7oNRzrnSr7woYAiJKJFHwHxZk?cluster=devnet) |
| 6 | Dar de baja a "Luna" (cierre de cuenta) | Refugio | [Ver en Explorer](https://explorer.solana.com/tx/4epK4q3mrYXaPJrEXEDNcS9E5wUvtduB6gasX82BNnZmQo1v6EuggAJEfQYKmrD5H99WVRnDfHUcbhKr6C9XtqAY?cluster=devnet) |

### Caso de rechazo observado en el frontend

Con la solicitud de "Luna" aún pendiente, el refugio intentó **Dar de baja** y el programa rechazó la operación. La interfaz mostró: _"No se puede dar de baja: la mascota tiene solicitudes pendientes"_ (error `TieneSolicitudesPendientes`, el mismo caso R2 de las pruebas). Después de aprobar la solicitud y cerrarla, la baja se realizó con éxito (transacción 6).

## Plantilla de partida y aporte propio

- **Punto de partida:** proyecto propio construido desde cero con Anchor 0.30.1 y el wallet adapter de Solana. No parte de la versión resuelta del proyecto guiado ni de una plantilla de aplicación; solo se reutilizan librerías (Anchor, React, Vite, wallet adapter).
- **Aporte propio:** el dominio completo de adopción: modelo de tres cuentas relacionadas por PDAs, flujo de solicitud/aprobación con autoridad exclusiva del refugio, dos reglas de cierre condicionado (baja de mascota y cierre de solicitud) y la validación de estado para evitar adopciones duplicadas.
- **Cómo se comprueba:** `anchor test --skip-build` (13 casos) y las 6 transacciones reales en Devnet listadas arriba.
- **Uso de IA:** se utilizó IA como apoyo para escribir y depurar el código; los cambios se revisaron, se entienden y se probaron (pruebas locales y flujo real en Devnet).

## Mejora opcional: asistente de consulta con IA (Taller 1)

La carpeta [`agente/`](agente/) agrega un asistente en lenguaje natural, de solo lectura, que consulta las cuentas de este programa en Devnet (LM Studio + Solana Agent Kit). Es independiente del programa, las pruebas y el frontend de arriba: no los modifica. Instrucciones, evidencias y limitaciones en [`agente/README.md`](agente/README.md).

## Seguridad

No se versionan llaves privadas: `.gitignore` excluye `*-keypair.json`, `id.json` y `target/`. Las wallets de prueba solo tienen SOL de Devnet.
