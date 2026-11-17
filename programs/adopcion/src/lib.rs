use anchor_lang::prelude::*;

// IMPORTANTE: reemplaza este ID con el tuyo después de `anchor keys sync`.
declare_id!("ATvb4Msom2jT342BSdzFWzaepzTPYxWdsrs1A1EacXUx");

pub const MAX_NOMBRE: usize = 32;
pub const MAX_MENSAJE: usize = 140;

#[program]
pub mod adopcion {
    use super::*;

    /// REGISTRO (equivalente a "Registro"): crea el refugio, dueño de las mascotas.
    pub fn crear_refugio(ctx: Context<CrearRefugio>, nombre: String) -> Result<()> {
        require!(
            !nombre.is_empty() && nombre.len() <= MAX_NOMBRE,
            AdopcionError::NombreInvalido
        );
        let refugio = &mut ctx.accounts.refugio;
        refugio.autoridad = ctx.accounts.autoridad.key();
        refugio.nombre = nombre;
        refugio.total_mascotas = 0;
        refugio.mascotas_activas = 0;
        refugio.total_adopciones = 0;
        refugio.bump = ctx.bumps.refugio;
        Ok(())
    }

    /// CREACIÓN (equivalente a "Cliente"): registra una mascota con PDA propia.
    /// El id viene de un contador del refugio, así nunca se repite aunque se den de baja.
    pub fn registrar_mascota(
        ctx: Context<RegistrarMascota>,
        nombre: String,
        especie: Especie,
        edad_meses: u16,
    ) -> Result<()> {
        require!(
            !nombre.is_empty() && nombre.len() <= MAX_NOMBRE,
            AdopcionError::NombreInvalido
        );
        let refugio = &mut ctx.accounts.refugio;
        let mascota = &mut ctx.accounts.mascota;

        mascota.refugio = refugio.key();
        mascota.id = refugio.total_mascotas;
        mascota.nombre = nombre;
        mascota.especie = especie;
        mascota.edad_meses = edad_meses;
        mascota.estado = EstadoMascota::Disponible;
        mascota.adoptante = None;
        mascota.solicitudes_pendientes = 0;
        mascota.bump = ctx.bumps.mascota;

        refugio.total_mascotas = refugio
            .total_mascotas
            .checked_add(1)
            .ok_or(AdopcionError::Desbordamiento)?;
        refugio.mascotas_activas = refugio
            .mascotas_activas
            .checked_add(1)
            .ok_or(AdopcionError::Desbordamiento)?;
        Ok(())
    }

    /// MODIFICACIÓN: solo la autoridad del refugio edita los datos de su mascota.
    pub fn actualizar_mascota(
        ctx: Context<ActualizarMascota>,
        nuevo_nombre: Option<String>,
        nueva_edad_meses: Option<u16>,
    ) -> Result<()> {
        let mascota = &mut ctx.accounts.mascota;
        if let Some(nombre) = nuevo_nombre {
            require!(
                !nombre.is_empty() && nombre.len() <= MAX_NOMBRE,
                AdopcionError::NombreInvalido
            );
            mascota.nombre = nombre;
        }
        if let Some(edad) = nueva_edad_meses {
            mascota.edad_meses = edad;
        }
        Ok(())
    }

    /// VENTA / OPERACIÓN DE NEGOCIO (equivalente a "Venta"): un adoptante pide adoptar.
    /// Una PDA por (mascota, adoptante) evita solicitudes duplicadas.
    pub fn solicitar_adopcion(ctx: Context<SolicitarAdopcion>, mensaje: String) -> Result<()> {
        require!(mensaje.len() <= MAX_MENSAJE, AdopcionError::MensajeLargo);
        let mascota = &mut ctx.accounts.mascota;
        require!(
            mascota.estado == EstadoMascota::Disponible,
            AdopcionError::MascotaNoDisponible
        );

        let solicitud = &mut ctx.accounts.solicitud;
        solicitud.mascota = mascota.key();
        solicitud.adoptante = ctx.accounts.adoptante.key();
        solicitud.mensaje = mensaje;
        solicitud.estado = EstadoSolicitud::Pendiente;
        solicitud.bump = ctx.bumps.solicitud;

        mascota.solicitudes_pendientes = mascota
            .solicitudes_pendientes
            .checked_add(1)
            .ok_or(AdopcionError::Desbordamiento)?;
        Ok(())
    }

    /// PERMISOS: solo la autoridad del refugio aprueba o rechaza.
    /// Aprobar marca la mascota como adoptada y guarda al adoptante.
    pub fn resolver_solicitud(ctx: Context<ResolverSolicitud>, aprobar: bool) -> Result<()> {
        let mascota = &mut ctx.accounts.mascota;
        let solicitud = &mut ctx.accounts.solicitud;
        let refugio = &mut ctx.accounts.refugio;

        require!(
            solicitud.estado == EstadoSolicitud::Pendiente,
            AdopcionError::SolicitudYaResuelta
        );

        if aprobar {
            require!(
                mascota.estado == EstadoMascota::Disponible,
                AdopcionError::MascotaNoDisponible
            );
            mascota.estado = EstadoMascota::Adoptada;
            mascota.adoptante = Some(solicitud.adoptante);
            solicitud.estado = EstadoSolicitud::Aprobada;
            refugio.total_adopciones = refugio
                .total_adopciones
                .checked_add(1)
                .ok_or(AdopcionError::Desbordamiento)?;
        } else {
            solicitud.estado = EstadoSolicitud::Rechazada;
        }

        mascota.solicitudes_pendientes = mascota
            .solicitudes_pendientes
            .checked_sub(1)
            .ok_or(AdopcionError::Desbordamiento)?;
        Ok(())
    }

    /// CIERRE 1: el adoptante cierra su solicitud ya resuelta y recupera la renta.
    /// Regla: no se puede cerrar mientras siga pendiente.
    pub fn cerrar_solicitud(_ctx: Context<CerrarSolicitud>) -> Result<()> {
        Ok(())
    }

    /// CIERRE 2 / BAJA CONDICIONADA: el refugio da de baja una mascota.
    /// Regla del programa: solo si no tiene solicitudes pendientes.
    pub fn dar_de_baja_mascota(ctx: Context<DarDeBajaMascota>) -> Result<()> {
        let refugio = &mut ctx.accounts.refugio;
        refugio.mascotas_activas = refugio
            .mascotas_activas
            .checked_sub(1)
            .ok_or(AdopcionError::Desbordamiento)?;
        Ok(())
    }
}

// ---------------------------------------------------------------- Contextos

#[derive(Accounts)]
pub struct CrearRefugio<'info> {
    #[account(
        init,
        payer = autoridad,
        space = 8 + Refugio::INIT_SPACE,
        seeds = [b"refugio", autoridad.key().as_ref()],
        bump
    )]
    pub refugio: Account<'info, Refugio>,
    #[account(mut)]
    pub autoridad: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegistrarMascota<'info> {
    #[account(
        mut,
        seeds = [b"refugio", autoridad.key().as_ref()],
        bump = refugio.bump,
        has_one = autoridad @ AdopcionError::NoAutorizado
    )]
    pub refugio: Account<'info, Refugio>,
    #[account(
        init,
        payer = autoridad,
        space = 8 + Mascota::INIT_SPACE,
        seeds = [b"mascota", refugio.key().as_ref(), &refugio.total_mascotas.to_le_bytes()],
        bump
    )]
    pub mascota: Account<'info, Mascota>,
    #[account(mut)]
    pub autoridad: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ActualizarMascota<'info> {
    #[account(
        seeds = [b"refugio", autoridad.key().as_ref()],
        bump = refugio.bump,
        has_one = autoridad @ AdopcionError::NoAutorizado
    )]
    pub refugio: Account<'info, Refugio>,
    #[account(
        mut,
        has_one = refugio @ AdopcionError::NoPertenece
    )]
    pub mascota: Account<'info, Mascota>,
    pub autoridad: Signer<'info>,
}

#[derive(Accounts)]
pub struct SolicitarAdopcion<'info> {
    #[account(mut)]
    pub mascota: Account<'info, Mascota>,
    #[account(
        init,
        payer = adoptante,
        space = 8 + Solicitud::INIT_SPACE,
        seeds = [b"solicitud", mascota.key().as_ref(), adoptante.key().as_ref()],
        bump
    )]
    pub solicitud: Account<'info, Solicitud>,
    #[account(mut)]
    pub adoptante: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolverSolicitud<'info> {
    #[account(
        mut,
        seeds = [b"refugio", autoridad.key().as_ref()],
        bump = refugio.bump,
        has_one = autoridad @ AdopcionError::NoAutorizado
    )]
    pub refugio: Account<'info, Refugio>,
    #[account(
        mut,
        has_one = refugio @ AdopcionError::NoPertenece
    )]
    pub mascota: Account<'info, Mascota>,
    #[account(
        mut,
        has_one = mascota @ AdopcionError::NoPertenece
    )]
    pub solicitud: Account<'info, Solicitud>,
    pub autoridad: Signer<'info>,
}

#[derive(Accounts)]
pub struct CerrarSolicitud<'info> {
    #[account(
        mut,
        close = adoptante,
        has_one = adoptante @ AdopcionError::NoAutorizado,
        constraint = solicitud.estado != EstadoSolicitud::Pendiente @ AdopcionError::SolicitudPendiente
    )]
    pub solicitud: Account<'info, Solicitud>,
    #[account(mut)]
    pub adoptante: Signer<'info>,
}

#[derive(Accounts)]
pub struct DarDeBajaMascota<'info> {
    #[account(
        mut,
        seeds = [b"refugio", autoridad.key().as_ref()],
        bump = refugio.bump,
        has_one = autoridad @ AdopcionError::NoAutorizado
    )]
    pub refugio: Account<'info, Refugio>,
    #[account(
        mut,
        close = autoridad,
        has_one = refugio @ AdopcionError::NoPertenece,
        constraint = mascota.solicitudes_pendientes == 0 @ AdopcionError::TieneSolicitudesPendientes
    )]
    pub mascota: Account<'info, Mascota>,
    #[account(mut)]
    pub autoridad: Signer<'info>,
}

// ------------------------------------------------------------------- Cuentas

#[account]
#[derive(InitSpace)]
pub struct Refugio {
    pub autoridad: Pubkey,
    #[max_len(MAX_NOMBRE)]
    pub nombre: String,
    pub total_mascotas: u32,
    pub mascotas_activas: u32,
    pub total_adopciones: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Mascota {
    pub refugio: Pubkey,
    pub id: u32,
    #[max_len(MAX_NOMBRE)]
    pub nombre: String,
    pub especie: Especie,
    pub edad_meses: u16,
    pub estado: EstadoMascota,
    pub adoptante: Option<Pubkey>,
    pub solicitudes_pendientes: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Solicitud {
    pub mascota: Pubkey,
    pub adoptante: Pubkey,
    #[max_len(MAX_MENSAJE)]
    pub mensaje: String,
    pub estado: EstadoSolicitud,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Especie {
    Perro,
    Gato,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum EstadoMascota {
    Disponible,
    Adoptada,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum EstadoSolicitud {
    Pendiente,
    Aprobada,
    Rechazada,
}

// ------------------------------------------------------------------- Errores

#[error_code]
pub enum AdopcionError {
    #[msg("El nombre está vacío o supera 32 caracteres")]
    NombreInvalido,
    #[msg("El mensaje supera 140 caracteres")]
    MensajeLargo,
    #[msg("No eres la autoridad de este refugio o de esta solicitud")]
    NoAutorizado,
    #[msg("La cuenta no pertenece al refugio o mascota indicados")]
    NoPertenece,
    #[msg("La mascota ya no está disponible para adopción")]
    MascotaNoDisponible,
    #[msg("La solicitud ya fue resuelta")]
    SolicitudYaResuelta,
    #[msg("No puedes cerrar una solicitud que sigue pendiente")]
    SolicitudPendiente,
    #[msg("No se puede dar de baja: la mascota tiene solicitudes pendientes")]
    TieneSolicitudesPendientes,
    #[msg("Desbordamiento aritmético")]
    Desbordamiento,
}
