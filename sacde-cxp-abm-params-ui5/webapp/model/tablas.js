sap.ui.define([], () => {
    "use strict";

    // ─────────────────────────────────────────────────────────────────────────
    // Catálogo de tablas del ABM.
    //
    // Las columnas y los tipos NO se declaran acá: salen del $metadata del
    // servicio (ver Main.controller.js). Esto sólo aporta lo que el metadata no
    // sabe: cómo se llama la tabla en castellano, para qué sirve, y qué campos
    // tienen una lista fija de valores.
    //
    // Agregar una tabla nueva al servicio y olvidarse de este archivo no rompe
    // nada: aparece igual, con el nombre técnico como título.
    //
    // OJO: `valoresFijos` es un espejo de las listas de srv/params-service.js.
    // Es sólo UX (un Select en vez de un Input); la validación de verdad está
    // en el backend. Si allá se agrega un valor, acá hay que agregarlo también
    // o el combo no lo va a ofrecer.
    // ─────────────────────────────────────────────────────────────────────────

    const SI_NO = ["SI", "NO"];

    return [
        {
            entidad: "Parametrizacion",
            titulo: "Parametrización general",
            descripcion: "Los valores sueltos del contexto que viaja al core: condiciones de pago de NC y ND, tolerancia. Fila única: se edita, no se borra.",
            icono: "sap-icon://settings",
            filaUnica: true
        },
        {
            entidad: "ParamRangos",
            titulo: "Rangos de parametrización",
            descripcion: "Las listas de valores que filtran lo que ve el portal: sociedades válidas, grupos de cuentas, clases de documento de pago.",
            icono: "sap-icon://filter",
            valoresFijos: {
                Campo: [
                    "itSociedadesValidas", "itKtokkGruposCuentas", "itKtokkFiltroSiglaAr",
                    "itBsartHechoCumplido", "itKschlAnticipo", "itCuitProveedorDesdeOc",
                    "itBlartDocpago", "itBlartDocpagoProv", "itSociedadesRigi",
                    "itKnttpRigi", "itWithtExcluido"
                ],
                Sign: ["I", "E"],
                Opcion: ["EQ", "BT", "CP", "NE", "GE", "LE", "GT", "LT"]
            }
        },
        {
            entidad: "BlartMapeo",
            titulo: "Clases de documento",
            descripcion: "Tipo de comprobante → clase de documento. Es la única fuente: el core ya no lo resuelve por su cuenta. Código ARCA 'DEF' = el valor por defecto.",
            icono: "sap-icon://document-text",
            valoresFijos: {
                Via: ["FI", "MIRO"],
                TipoComp: ["FT", "TF", "NC", "ND", "FA", "NA"]
            }
        },
        {
            entidad: "CatalogoImpuestos",
            titulo: "Catálogo de impuestos",
            descripcion: "Impuestos y jurisdicciones que ofrece el portal al cargar un comprobante. La jurisdicción es parte de la clave: cada provincia de IIBB es una fila.",
            icono: "sap-icon://official-service",
            valoresFijos: {
                TipoPos: ["COM", "SERV", "MAT", "RIGI"]
            }
        },
        {
            entidad: "PadronPercepciones",
            titulo: "Padrón de percepciones",
            descripcion: "Alícuotas de percepción por CUIT, impuesto y jurisdicción, con vigencia. Se mantiene a mano: no hay carga automática del padrón.",
            icono: "sap-icon://collections-management",
            valoresFijos: {
                Spercep: SI_NO
            }
        },
        {
            entidad: "Fce",
            titulo: "Facturas de Crédito Electrónica",
            descripcion: "Comprobantes MiPyME con su cuenta corriente.",
            icono: "sap-icon://credit-card"
        },
        {
            entidad: "TipoComprobante",
            titulo: "Tipos de comprobante",
            descripcion: "Equivalencia entre el tipo de comprobante interno y el de ARCA, con su carácter impositivo.",
            icono: "sap-icon://list"
        },
        {
            entidad: "UsuariosPortal",
            titulo: "Usuarios del portal",
            descripcion: "Solo consulta. El mapeo mail ↔ proveedor lo resuelven el IAS y el core ABAP; esta tabla quedó sin uso y normalmente está vacía.",
            icono: "sap-icon://employee",
            soloLectura: true
        },
        {
            entidad: "UsuariosPortalEstado",
            titulo: "Estado de los usuarios",
            descripcion: "Solo consulta. Último ingreso al portal de cada usuario: lo graba el propio login, y editarlo a mano sería falsear la auditoría.",
            icono: "sap-icon://history",
            soloLectura: true
        },
        {
            entidad: "Impersonar",
            titulo: "Impersonación (testeo)",
            descripcion: "Simula el login de otro usuario para probar. No hace nada salvo que la env var IMPERSONACION_ACTIVA esté en 'true': ese es el freno de producción.",
            icono: "sap-icon://key-user-settings",
            valoresFijos: {
                TipoUsuario: ["Usuario Proveedor", "Usuario Interno"]
            }
        }
    ];
});
