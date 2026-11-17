#!/usr/bin/env python3
"""Genera target/idl/adopcion.json y target/types/adopcion.ts para Anchor 0.30.

Se usa porque `anchor idl build` falla con Rust reciente (ark-bn254). El IDL se
deriva de programs/adopcion/src/lib.rs: mismas instrucciones, cuentas y errores.
Ejecutar desde la raiz del repo:  python3 generar_idl.py
"""
import hashlib, json, os, re, sys

RAIZ = os.getcwd()
LIB = os.path.join(RAIZ, "programs/adopcion/src/lib.rs")
if not os.path.exists(LIB):
    sys.exit("Ejecuta este script desde la raiz del repo (donde esta Anchor.toml).")

src = open(LIB, encoding="utf-8").read()
m = re.search(r'declare_id!\("([1-9A-HJ-NP-Za-km-z]{32,44})"\)', src)
if not m:
    sys.exit("No encontre declare_id! en lib.rs")
ADDRESS = m.group(1)


def disc(prefijo, nombre):
    return list(hashlib.sha256(f"{prefijo}:{nombre}".encode()).digest()[:8])


SYS = "11111111111111111111111111111111"


def cta(nombre, w=False, s=False, addr=None):
    d = {"name": nombre}
    if w:
        d["writable"] = True
    if s:
        d["signer"] = True
    if addr:
        d["address"] = addr
    return d


def ix(nombre, cuentas, args):
    return {
        "name": nombre,
        "discriminator": disc("global", nombre),
        "accounts": cuentas,
        "args": [{"name": n, "type": t} for n, t in args],
    }


def defined(n):
    return {"defined": {"name": n}}


instrucciones = [
    ix("crear_refugio",
       [cta("refugio", w=True), cta("autoridad", w=True, s=True), cta("system_program", addr=SYS)],
       [("nombre", "string")]),
    ix("registrar_mascota",
       [cta("refugio", w=True), cta("mascota", w=True), cta("autoridad", w=True, s=True),
        cta("system_program", addr=SYS)],
       [("nombre", "string"), ("especie", defined("Especie")), ("edad_meses", "u16")]),
    ix("actualizar_mascota",
       [cta("refugio"), cta("mascota", w=True), cta("autoridad", s=True)],
       [("nuevo_nombre", {"option": "string"}), ("nueva_edad_meses", {"option": "u16"})]),
    ix("solicitar_adopcion",
       [cta("mascota", w=True), cta("solicitud", w=True), cta("adoptante", w=True, s=True),
        cta("system_program", addr=SYS)],
       [("mensaje", "string")]),
    ix("resolver_solicitud",
       [cta("refugio", w=True), cta("mascota", w=True), cta("solicitud", w=True),
        cta("autoridad", s=True)],
       [("aprobar", "bool")]),
    ix("cerrar_solicitud",
       [cta("solicitud", w=True), cta("adoptante", w=True, s=True)], []),
    ix("dar_de_baja_mascota",
       [cta("refugio", w=True), cta("mascota", w=True), cta("autoridad", w=True, s=True)], []),
]

# Verifica que las instrucciones del IDL existan en el programa (evita desfases).
fns = set(re.findall(r"pub fn (\w+)\(\s*(?:_?ctx)", src))
for i in instrucciones:
    if i["name"] not in fns:
        sys.exit(f"La instruccion {i['name']} no existe en lib.rs; actualiza el script.")

estructuras = {
    "Refugio": [("autoridad", "pubkey"), ("nombre", "string"), ("total_mascotas", "u32"),
                ("mascotas_activas", "u32"), ("total_adopciones", "u32"), ("bump", "u8")],
    "Mascota": [("refugio", "pubkey"), ("id", "u32"), ("nombre", "string"),
                ("especie", defined("Especie")), ("edad_meses", "u16"),
                ("estado", defined("EstadoMascota")), ("adoptante", {"option": "pubkey"}),
                ("solicitudes_pendientes", "u8"), ("bump", "u8")],
    "Solicitud": [("mascota", "pubkey"), ("adoptante", "pubkey"), ("mensaje", "string"),
                  ("estado", defined("EstadoSolicitud")), ("bump", "u8")],
}
enums = {
    "Especie": ["Perro", "Gato"],
    "EstadoMascota": ["Disponible", "Adoptada"],
    "EstadoSolicitud": ["Pendiente", "Aprobada", "Rechazada"],
}

tipos = []
for n, campos in estructuras.items():
    tipos.append({"name": n, "type": {"kind": "struct",
                                      "fields": [{"name": a, "type": t} for a, t in campos]}})
for n, vs in enums.items():
    tipos.append({"name": n, "type": {"kind": "enum", "variants": [{"name": v} for v in vs]}})

# Errores: se leen de lib.rs para que mensajes y codigos coincidan.
bloque = re.search(r"pub enum AdopcionError \{(.*?)\n\}", src, re.S).group(1)
errores = []
for cod, (msg, nombre) in enumerate(re.findall(r'#\[msg\("([^"]*)"\)\]\s*(\w+),', bloque), start=6000):
    errores.append({"code": cod, "name": nombre, "msg": msg})

idl = {
    "address": ADDRESS,
    "metadata": {"name": "adopcion", "version": "0.1.0", "spec": "0.1.0",
                 "description": "Portal de adopcion de perros y gatos en Solana"},
    "instructions": instrucciones,
    "accounts": [{"name": n, "discriminator": disc("account", n)} for n in estructuras],
    "errors": errores,
    "types": tipos,
}

os.makedirs("target/idl", exist_ok=True)
os.makedirs("target/types", exist_ok=True)
js = json.dumps(idl, indent=2, ensure_ascii=False)
open("target/idl/adopcion.json", "w", encoding="utf-8").write(js + "\n")
open("target/types/adopcion.ts", "w", encoding="utf-8").write(
    "export type Adopcion = " + js + ";\n")

# Copia para el frontend
os.makedirs("frontend/src/idl", exist_ok=True)
open("frontend/src/idl/adopcion.json", "w", encoding="utf-8").write(js + "\n")
open("frontend/src/idl/adopcion.ts", "w", encoding="utf-8").write(
    "export type Adopcion = " + js + ";\n")

print(f"OK  address={ADDRESS}")
print(f"    {len(instrucciones)} instrucciones, {len(estructuras)} cuentas, {len(errores)} errores")
print("    escrito: target/idl/adopcion.json, target/types/adopcion.ts, frontend/src/idl/")
