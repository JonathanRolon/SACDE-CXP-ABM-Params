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
            descripcion: "Los escalares del contexto (ex ZFIT123). Fila única DEFAULT: se edita, no se borra.",
            icono: "sap-icon://settings",
            filaUnica: true
        },
        {
            entidad: "ParamRangos",
            titulo: "Rangos de parametrización",
            descripcion: "Los RANGE OF que viajan al core ABAP: sociedades válidas, grupos de cuentas, clases de documento de pago, etc.",
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
            descripcion: "Tipo de comprobante → clase de documento (BLART). Única fuente de verdad: el ABAP ya no lee ZFIT123. CodArca 'DEF' es el default.",
            icono: "sap-icon://document-text",
            valoresFijos: {
                Via: ["FI", "MIRO"],
                TipoComp: ["FT", "TF", "NC", "ND"]
            }
        },
        {
            entidad: "CatalogoImpuestos",
            titulo: "Catálogo de impuestos",
            descripcion: "ex ZFIT125. La jurisdicción es parte de la key: sin ella las 24 filas de IIBB colapsan en una sola y el combo pierde las provincias.",
            icono: "sap-icon://official-service",
            valoresFijos: {
                TipoPos: ["COM", "SERV", "MAT", "RIGI"]
            }
        },
        {
            entidad: "PadronPercepciones",
            titulo: "Padrón de percepciones",
            descripcion: "ex ZFIT126. Alícuotas por CUIT, impuesto y jurisdicción, con vigencia. Hoy se mantiene a mano: no hay carga automática del padrón.",
            icono: "sap-icon://collections-management",
            valoresFijos: {
                Spercep: SI_NO
            }
        },
        {
            entidad: "Fce",
            titulo: "Facturas de Crédito Electrónica",
            descripcion: "ex ZEVC_FECRED. Comprobantes MiPyME con su cuenta corriente.",
            icono: "sap-icon://credit-card"
        },
        {
            entidad: "TipoComprobante",
            titulo: "Tipos de comprobante",
            descripcion: "ex ZFIT_TIPO_COMP. Tipo interno ↔ tipo AFIP/ARCA y carácter impositivo.",
            icono: "sap-icon://list"
        },
        {
            entidad: "UsuariosPortal",
            titulo: "Usuarios del portal",
            descripcion: "ex ZFIT122. Qué mail corresponde a qué proveedor (LIFNR). Sin fila acá, un proveedor no ve nada.",
            icono: "sap-icon://employee",
            valoresFijos: {}
        },
        {
            entidad: "UsuariosPortalEstado",
            titulo: "Estado de los usuarios",
            descripcion: "ex ZFIT124. Último ingreso y cuenta validada. La escribe el propio login; se toca sólo para corregir.",
            icono: "sap-icon://history",
            valoresFijos: {
                Validada: ["X"]
            }
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
