export type Adopcion = {
  "address": "ATvb4Msom2jT342BSdzFWzaepzTPYxWdsrs1A1EacXUx",
  "metadata": {
    "name": "adopcion",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Portal de adopcion de perros y gatos en Solana"
  },
  "instructions": [
    {
      "name": "crear_refugio",
      "discriminator": [
        85,
        253,
        146,
        189,
        48,
        130,
        136,
        202
      ],
      "accounts": [
        {
          "name": "refugio",
          "writable": true
        },
        {
          "name": "autoridad",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nombre",
          "type": "string"
        }
      ]
    },
    {
      "name": "registrar_mascota",
      "discriminator": [
        8,
        181,
        254,
        68,
        198,
        83,
        16,
        229
      ],
      "accounts": [
        {
          "name": "refugio",
          "writable": true
        },
        {
          "name": "mascota",
          "writable": true
        },
        {
          "name": "autoridad",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nombre",
          "type": "string"
        },
        {
          "name": "especie",
          "type": {
            "defined": {
              "name": "Especie"
            }
          }
        },
        {
          "name": "edad_meses",
          "type": "u16"
        }
      ]
    },
    {
      "name": "actualizar_mascota",
      "discriminator": [
        130,
        41,
        165,
        243,
        208,
        231,
        167,
        165
      ],
      "accounts": [
        {
          "name": "refugio"
        },
        {
          "name": "mascota",
          "writable": true
        },
        {
          "name": "autoridad",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "nuevo_nombre",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "nueva_edad_meses",
          "type": {
            "option": "u16"
          }
        }
      ]
    },
    {
      "name": "solicitar_adopcion",
      "discriminator": [
        150,
        153,
        183,
        90,
        58,
        135,
        224,
        181
      ],
      "accounts": [
        {
          "name": "mascota",
          "writable": true
        },
        {
          "name": "solicitud",
          "writable": true
        },
        {
          "name": "adoptante",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "mensaje",
          "type": "string"
        }
      ]
    },
    {
      "name": "resolver_solicitud",
      "discriminator": [
        69,
        206,
        158,
        76,
        123,
        26,
        248,
        141
      ],
      "accounts": [
        {
          "name": "refugio",
          "writable": true
        },
        {
          "name": "mascota",
          "writable": true
        },
        {
          "name": "solicitud",
          "writable": true
        },
        {
          "name": "autoridad",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "aprobar",
          "type": "bool"
        }
      ]
    },
    {
      "name": "cerrar_solicitud",
      "discriminator": [
        153,
        130,
        76,
        234,
        63,
        182,
        122,
        157
      ],
      "accounts": [
        {
          "name": "solicitud",
          "writable": true
        },
        {
          "name": "adoptante",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "dar_de_baja_mascota",
      "discriminator": [
        87,
        173,
        42,
        103,
        3,
        100,
        121,
        237
      ],
      "accounts": [
        {
          "name": "refugio",
          "writable": true
        },
        {
          "name": "mascota",
          "writable": true
        },
        {
          "name": "autoridad",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "Refugio",
      "discriminator": [
        243,
        171,
        81,
        241,
        65,
        134,
        54,
        15
      ]
    },
    {
      "name": "Mascota",
      "discriminator": [
        177,
        78,
        191,
        38,
        198,
        49,
        164,
        57
      ]
    },
    {
      "name": "Solicitud",
      "discriminator": [
        63,
        27,
        53,
        166,
        199,
        216,
        230,
        206
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "NombreInvalido",
      "msg": "El nombre está vacío o supera 32 caracteres"
    },
    {
      "code": 6001,
      "name": "MensajeLargo",
      "msg": "El mensaje supera 140 caracteres"
    },
    {
      "code": 6002,
      "name": "NoAutorizado",
      "msg": "No eres la autoridad de este refugio o de esta solicitud"
    },
    {
      "code": 6003,
      "name": "NoPertenece",
      "msg": "La cuenta no pertenece al refugio o mascota indicados"
    },
    {
      "code": 6004,
      "name": "MascotaNoDisponible",
      "msg": "La mascota ya no está disponible para adopción"
    },
    {
      "code": 6005,
      "name": "SolicitudYaResuelta",
      "msg": "La solicitud ya fue resuelta"
    },
    {
      "code": 6006,
      "name": "SolicitudPendiente",
      "msg": "No puedes cerrar una solicitud que sigue pendiente"
    },
    {
      "code": 6007,
      "name": "TieneSolicitudesPendientes",
      "msg": "No se puede dar de baja: la mascota tiene solicitudes pendientes"
    },
    {
      "code": 6008,
      "name": "Desbordamiento",
      "msg": "Desbordamiento aritmético"
    }
  ],
  "types": [
    {
      "name": "Refugio",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "autoridad",
            "type": "pubkey"
          },
          {
            "name": "nombre",
            "type": "string"
          },
          {
            "name": "total_mascotas",
            "type": "u32"
          },
          {
            "name": "mascotas_activas",
            "type": "u32"
          },
          {
            "name": "total_adopciones",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "Mascota",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "refugio",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u32"
          },
          {
            "name": "nombre",
            "type": "string"
          },
          {
            "name": "especie",
            "type": {
              "defined": {
                "name": "Especie"
              }
            }
          },
          {
            "name": "edad_meses",
            "type": "u16"
          },
          {
            "name": "estado",
            "type": {
              "defined": {
                "name": "EstadoMascota"
              }
            }
          },
          {
            "name": "adoptante",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "solicitudes_pendientes",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "Solicitud",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mascota",
            "type": "pubkey"
          },
          {
            "name": "adoptante",
            "type": "pubkey"
          },
          {
            "name": "mensaje",
            "type": "string"
          },
          {
            "name": "estado",
            "type": {
              "defined": {
                "name": "EstadoSolicitud"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "Especie",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Perro"
          },
          {
            "name": "Gato"
          }
        ]
      }
    },
    {
      "name": "EstadoMascota",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Disponible"
          },
          {
            "name": "Adoptada"
          }
        ]
      }
    },
    {
      "name": "EstadoSolicitud",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Pendiente"
          },
          {
            "name": "Aprobada"
          },
          {
            "name": "Rechazada"
          }
        ]
      }
    }
  ]
};
