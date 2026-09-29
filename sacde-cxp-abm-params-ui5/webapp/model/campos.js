sap.ui.define([
    "sap/m/Text",
    "sap/m/Input",
    "sap/m/CheckBox",
    "sap/m/DatePicker",
    "sap/m/TimePicker",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/ui/model/odata/type/String",
    "sap/ui/model/odata/type/Boolean",
    "sap/ui/model/odata/type/Decimal",
    "sap/ui/model/odata/type/Int32",
    "sap/ui/model/odata/type/Date",
    "sap/ui/model/odata/type/TimeOfDay",
    "sap/ui/model/odata/type/DateTimeOffset",
    "sap/ui/model/odata/type/Guid"
], (Text, Input, CheckBox, DatePicker, TimePicker, Select, Item,
    TipoString, TipoBoolean, TipoDecimal, TipoInt32, TipoDate, TipoTimeOfDay,
    TipoDateTimeOffset, TipoGuid) => {
    "use strict";

    // ─────────────────────────────────────────────────────────────────────────
    // Lectura del $metadata y armado de controles.
    //
    // Todo lo que el ABM sabe de una tabla sale de acá: qué campos tiene, cuáles
    // son key, cuáles son obligatorios y de qué tipo. Así no hay una vista por
    // tabla ni una lista de columnas que se desincronice del modelo CDS.
    // ─────────────────────────────────────────────────────────────────────────

    // Las pone @sap/cds con el aspecto `managed`. No se editan: las escribe el
    // framework en cada INSERT/UPDATE.
    const AUDITORIA = ["createdAt", "createdBy", "modifiedAt", "modifiedBy"];

    const TIPOS = {
        "Edm.String"        : { clase: TipoString,         constraints: c => ({ maxLength: c.maxLength, nullable: c.nullable }) },
        "Edm.Boolean"       : { clase: TipoBoolean,        constraints: c => ({ nullable: c.nullable }) },
        "Edm.Decimal"       : { clase: TipoDecimal,        constraints: c => ({ precision: c.precision, scale: c.scale, nullable: c.nullable }), numerico: true },
        "Edm.Int32"         : { clase: TipoInt32,          constraints: c => ({ nullable: c.nullable }), numerico: true },
        "Edm.Date"          : { clase: TipoDate,           constraints: c => ({ nullable: c.nullable }) },
        "Edm.TimeOfDay"     : { clase: TipoTimeOfDay,      constraints: c => ({ precision: c.precision, nullable: c.nullable }) },
        "Edm.DateTimeOffset": { clase: TipoDateTimeOffset, constraints: c => ({ precision: c.precision, nullable: c.nullable }) },
        "Edm.Guid"          : { clase: TipoGuid,           constraints: () => ({}) }
    };

    const tipoDe = (campo) => {
        const oDef = TIPOS[campo.tipo] || TIPOS["Edm.String"];
        return new oDef.clase({}, oDef.constraints(campo));
    };

    /** 'IvZtermNc' -> 'Iv Zterm Nc'; 'Cuit' -> 'Cuit'. */
    const etiqueta = (campo) => campo.nombre
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/^./, s => s.toUpperCase());

    /**
     * Lee el $metadata del servicio y devuelve la descripción de cada campo.
     * Se apoya sólo en el meta modelo: si mañana el CDS cambia un largo o suma
     * una columna, el ABM la toma sin tocar código.
     */
    const leer = async (oModel, sEntidad) => {
        const oTipo = await oModel.getMetaModel().requestObject("/" + sEntidad + "/");
        const aKeys = oTipo.$Key || [];

        return Object.keys(oTipo)
            .filter(k => !k.startsWith("$") && oTipo[k].$kind === "Property")
            .map(sNombre => {
                const oProp = oTipo[sNombre];
                const bClave = aKeys.includes(sNombre);
                return {
                    nombre     : sNombre,
                    tipo       : oProp.$Type,
                    clave      : bClave,
                    auditoria  : AUDITORIA.includes(sNombre),
                    // Key UUID: la genera el CAP en el INSERT, no se pide.
                    generado   : bClave && oProp.$Type === "Edm.Guid",
                    obligatorio: bClave || oProp.$Nullable === false,
                    nullable   : bClave ? false : oProp.$Nullable !== false,
                    maxLength  : oProp.$MaxLength,
                    precision  : oProp.$Precision,
                    scale      : oProp.$Scale,
                    numerico   : !!(TIPOS[oProp.$Type] || {}).numerico,
                    porDefecto : oProp.$DefaultValue
                };
            });
    };

    /** Celda de la tabla: siempre texto formateado con el tipo OData. */
    const celda = (campo) => new Text({
        text: { path: campo.nombre, type: tipoDe(campo) },
        wrapping: false
    });

    /**
     * Control de edición según el tipo.
     * `oValoresFijos` es el mapa opcional de model/tablas.js: si el campo está
     * ahí, va un desplegable en lugar de un input libre.
     */
    const editor = (campo, bEditable, oValoresFijos) => {
        const oBinding = { path: campo.nombre, type: tipoDe(campo) };
        const aFijos = (oValoresFijos || {})[campo.nombre];

        if (aFijos && aFijos.length) {
            return new Select({
                selectedKey: oBinding,
                enabled: bEditable,
                forceSelection: false,
                width: "100%",
                // Cada valor es un string, o { key, text } si conviene mostrar descripción.
                items: aFijos.map(v => typeof v === "object"
                    ? new Item({ key: v.key, text: v.text })
                    : new Item({ key: v, text: v }))
            });
        }

        switch (campo.tipo) {
            case "Edm.Boolean":
                return new CheckBox({ selected: oBinding, editable: bEditable });
            case "Edm.Date":
                return new DatePicker({
                    value: oBinding, editable: bEditable,
                    displayFormat: "dd/MM/yyyy", width: "100%"
                });
            case "Edm.TimeOfDay":
                return new TimePicker({
                    value: oBinding, editable: bEditable,
                    displayFormat: "HH:mm:ss", valueFormat: "HH:mm:ss", width: "100%"
                });
            case "Edm.Decimal":
            case "Edm.Int32":
                return new Input({
                    value: oBinding, editable: bEditable,
                    type: "Number", textAlign: "End", width: "100%"
                });
            default:
                return new Input({
                    value: oBinding, editable: bEditable,
                    maxLength: campo.maxLength || 0, width: "100%"
                });
        }
    };

    return { leer, etiqueta, celda, editor, AUDITORIA };
});
