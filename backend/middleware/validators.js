function badRequest(res, error) {
  return res.status(400).json({ error });
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

exports.validateAuthLogin = (req, res, next) => {
  const { username, password } = req.body || {};
  if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
    return badRequest(res, 'Usuario y contraseña requeridos');
  }
  next();
};

exports.validateAuthRegister = (req, res, next) => {
  const { username, password, nombre, rol } = req.body || {};
  if (!isNonEmptyString(username) || !isNonEmptyString(password) || !isNonEmptyString(nombre)) {
    return badRequest(res, 'Username, contraseña y nombre son requeridos');
  }

  const rolesValidos = ['superadmin', 'admin', 'operador', 'visor'];
  if (rol && !rolesValidos.includes(rol)) {
    return badRequest(res, 'Rol inválido');
  }

  next();
};

exports.validateUsuarioCreate = (req, res, next) => {
  const { username, password, nombre, rol } = req.body || {};
  if (!isNonEmptyString(username) || !isNonEmptyString(password) || !isNonEmptyString(nombre)) {
    return badRequest(res, 'Username, contraseña y nombre son requeridos');
  }

  const rolesValidos = ['superadmin', 'admin', 'operador', 'visor'];
  if (rol && !rolesValidos.includes(rol)) {
    return badRequest(res, 'Rol inválido');
  }

  next();
};

exports.validateUsuarioUpdate = (req, res, next) => {
  const { username, nombre, rol, activo, password } = req.body || {};

  if (!isNonEmptyString(username) || !isNonEmptyString(nombre)) {
    return badRequest(res, 'Username y nombre son requeridos');
  }

  const rolesValidos = ['superadmin', 'admin', 'operador', 'visor'];
  if (!isNonEmptyString(rol) || !rolesValidos.includes(rol)) {
    return badRequest(res, 'Rol inválido');
  }

  if (activo !== undefined && typeof activo !== 'boolean' && activo !== 0 && activo !== 1) {
    return badRequest(res, 'El campo activo debe ser booleano');
  }

  if (password !== undefined && typeof password !== 'string') {
    return badRequest(res, 'Formato de contraseña inválido');
  }

  next();
};

exports.validateTicketCreate = (req, res, next) => {
  const { cliente_id, origen, destino, cantidad_camiones, fecha_requerida } = req.body || {};

  if (!cliente_id || Number.isNaN(Number(cliente_id))) {
    return badRequest(res, 'cliente_id es requerido y debe ser numérico');
  }

  if (!isNonEmptyString(origen)) {
    return badRequest(res, 'origen es requerido');
  }

  if (destino !== undefined && destino !== null && typeof destino !== 'string') {
    return badRequest(res, 'destino inválido');
  }

  if (cantidad_camiones !== undefined && (!Number.isInteger(Number(cantidad_camiones)) || Number(cantidad_camiones) <= 0)) {
    return badRequest(res, 'cantidad_camiones debe ser un entero mayor a 0');
  }

  if (!isNonEmptyString(fecha_requerida)) {
    return badRequest(res, 'fecha_requerida es requerida');
  }

  next();
};

exports.validateTicketEstado = (req, res, next) => {
  const { estado } = req.body || {};
  const estadosValidos = [
    'Pendiente de asignación',
    'Asignado - Esperando respuesta',
    'Aceptado - Pendiente datos camión',
    'En proceso de confirmación',
    'Listo para confirmar al cliente',
    'Confirmado al cliente',
    'Rechazado',
    'Cancelado',
  ];

  if (!isNonEmptyString(estado) || !estadosValidos.includes(estado)) {
    return badRequest(res, 'Estado inválido');
  }

  next();
};
