sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/ui/core/Messaging",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Text",
    "sap/m/Title",
    "sap/m/Button",
    "sap/m/Dialog",
    "sap/m/Label",
    "sap/m/SearchField",
    "sap/m/OverflowToolbar",
    "sap/m/ToolbarSpacer",
    "sap/ui/layout/form/SimpleForm",
    "sacdecxpabmparamsui5/model/tablas",
    "sacdecxpabmparamsui5/model/campos"
], (Controller, JSONModel, Filter, FilterOperator, Sorter, Messaging, MessageBox,
    MessageToast, Table, Column, ColumnListItem, Text, Title, Button, Dialog,
    Label, SearchField, OverflowToolbar, ToolbarSpacer, SimpleForm,
    catalogoTablas, campos) => {
    "use strict";

    // ─────────────────────────────────────────────────────────────────────────
    // ABM genérico sobre CxpParamsService.
    //
    // No hay una vista por tabla: las columnas, los tipos y las keys salen del
    // $metadata del servicio. Agregar una entidad al servicio alcanza para que
    // aparezca acá con su ABM (el catálogo de model/tablas.js sólo le pone
    // nombre y descripción en castellano).
    //
    // Los cambios del diálogo van al grupo diferido "abm" (ver manifest.json):
    // nada se manda al servidor hasta el Guardar, y Cancelar los descarta.
    // ─────────────────────────────────────────────────────────────────────────

    return Controller.extend("sacdecxpabmparamsui5.controller.Main", {

        onInit() {
            const oVista = this.getView();

            oVista.setModel(new JSONModel({ tablas: catalogoTablas }), "tablas");
            oVista.setModel(new JSONModel({
                tituloTabla: "",
                descripcionTabla: "",
                hayTabla: false
            }), "ui");

            // Para que los errores de tipo del formulario (largo máximo, número
            // mal formado) se marquen en el campo en vez de perderse.
            Messaging.registerObject(oVista, true);

            this._tabla = null;       // sap.m.Table armada al vuelo
            this._binding = null;     // su ODataListBinding
            this._tablaActual = null; // entrada del catálogo
            this._campos = [];
            this._dialogo = null;
            this._contextoEdicion = null;
            this._esAlta = false;
        },

        // ── Navegación ────────────────────────────────────────────────────

        async onSeleccionarTabla(oEvent) {
            const oItem = oEvent.getParameter("listItem") || oEvent.getSource();
            await this._abrirTabla(oItem.getBindingContext("tablas").getObject());
            this.byId("splitApp").toDetail(this.byId("paginaDetalle"));
        },

        async _abrirTabla(oEntrada) {
            // Cambiar de tabla con cambios sin guardar dejaría un POST pendiente
            // que se dispararía en el próximo submitBatch, sobre otra entidad.
            const oModelo = this.getView().getModel();
            if (oModelo.hasPendingChanges("abm")) oModelo.resetChanges("abm");

            this._tablaActual = oEntrada;
            this.getView().getModel("ui").setData({
                tituloTabla: oEntrada.titulo,
                descripcionTabla: oEntrada.descripcion || "",
                hayTabla: true
            });

            try {
                this._campos = await campos.leer(oModelo, oEntrada.entidad);
                this._construirTabla(oEntrada, this._campos);
            } catch (oError) {
                // Adentro del try también el armado de la tabla: si falla ahí,
                // la excepción se perdía en un unhandled rejection y lo único
                // que se veía era el detalle en blanco.
                return this._mostrarError(oError, this._tituloDeError(oError, oEntrada.entidad));
            }
        },

        // ── Tabla ─────────────────────────────────────────────────────────

        _construirTabla(oEntrada, aCampos) {
            const oContenedor = this.byId("detalle");
            oContenedor.destroyItems();

            // Datos primero; modifiedAt/By al final, como pista de auditoría.
            const aVisibles = aCampos.filter(c => !c.auditoria).concat(
                aCampos.filter(c => c.nombre === "modifiedAt"),
                aCampos.filter(c => c.nombre === "modifiedBy")
            );

            const bSoloLectura = !!oEntrada.soloLectura;

            const oTabla = new Table({
                mode: bSoloLectura ? "None" : "SingleSelectLeft",
                growing: true,
                growingThreshold: 100,
                growingScrollToLoad: true,
                sticky: ["ColumnHeaders", "HeaderToolbar"],
                noDataText: "Sin filas cargadas",
                columns: aVisibles.map(c => new Column({
                    header: new Text({ text: campos.etiqueta(c) }),
                    hAlign: c.numerico ? "End" : "Begin",
                    // Las keys siempre visibles; el resto cede en pantallas
                    // chicas y baja al popin antes que romper el layout.
                    minScreenWidth: c.clave ? "Phone" : "Tablet",
                    demandPopin: !c.clave,
                    popinDisplay: "Inline"
                })),
                items: {
                    path: "/" + oEntrada.entidad,
                    parameters: { $count: true },
                    sorter: aCampos.filter(c => c.clave).map(c => new Sorter(c.nombre)),
                    template: new ColumnListItem({
                        type: bSoloLectura ? "Inactive" : "Active",
                        cells: aVisibles.map(c => campos.celda(c))
                    })
                }
            });

            if (!bSoloLectura) oTabla.attachItemPress(this.onEditar, this);
            oTabla.setHeaderToolbar(this._construirToolbar(oEntrada));

            this._tabla = oTabla;

            // El addItem va ANTES de pedir el binding, y el orden no es un
            // detalle: una tabla que todavía no está en el árbol de controles
            // no heredó el modelo, así que el binding de "items" ni siquiera
            // existe todavía y getBinding devuelve undefined.
            oContenedor.addItem(oTabla);

            this._binding = oTabla.getBinding("items");
            this._binding.attachDataReceived(this._actualizarContador, this);
        },

        _construirToolbar(oEntrada) {
            this._titulo = new Title({ text: oEntrada.titulo, level: "H2" });

            const aBotones = [];

            // Tablas de consulta: el backend las expone @readonly, así que los
            // botones de ABM no fallarían con un mensaje claro, fallarían con
            // un 405. Mejor que no estén.
            if (oEntrada.soloLectura) {
                return new OverflowToolbar({
                    content: [
                        this._titulo,
                        new ToolbarSpacer(),
                        new SearchField({
                            width: "18rem",
                            placeholder: "Buscar…",
                            search: this.onBuscar.bind(this)
                        }),
                        new Button({
                            icon: "sap-icon://refresh", tooltip: "Refrescar",
                            press: () => this._binding.refresh()
                        })
                    ]
                });
            }

            if (!oEntrada.filaUnica) {
                aBotones.push(new Button({
                    text: "Crear", icon: "sap-icon://add", type: "Emphasized",
                    press: this.onCrear.bind(this)
                }));
            }
            aBotones.push(new Button({
                text: "Editar", icon: "sap-icon://edit",
                press: this.onEditar.bind(this)
            }));
            if (!oEntrada.filaUnica) {
                aBotones.push(new Button({
                    text: "Borrar", icon: "sap-icon://delete",
                    press: this.onBorrar.bind(this)
                }));
            }
            aBotones.push(new Button({
                icon: "sap-icon://refresh", tooltip: "Refrescar",
                press: () => this._binding.refresh()
            }));

            return new OverflowToolbar({
                content: [
                    this._titulo,
                    new ToolbarSpacer(),
                    new SearchField({
                        width: "18rem",
                        placeholder: "Buscar…",
                        search: this.onBuscar.bind(this)
                    })
                ].concat(aBotones)
            });
        },

        _actualizarContador() {
            const iTotal = this._binding.getHeaderContext().getProperty("$count");
            this._titulo.setText(iTotal === undefined
                ? this._tablaActual.titulo
                : `${this._tablaActual.titulo} (${iTotal})`);
        },

        onBuscar(oEvent) {
            const sTexto = (oEvent.getParameter("query") || "").trim();
            // Contains sobre todos los campos de texto: es lo que se espera de
            // una búsqueda de SM30, y estas tablas son chicas.
            const aFiltros = sTexto
                ? this._campos
                    .filter(c => c.tipo === "Edm.String" && !c.auditoria)
                    .map(c => new Filter(c.nombre, FilterOperator.Contains, sTexto))
                : [];
            this._binding.filter(aFiltros.length
                ? new Filter({ filters: aFiltros, and: false })
                : []);
        },

        // ── ABM ───────────────────────────────────────────────────────────

        onCrear() {
            // Defaults del modelo CDS (Sign='I', Opcion='EQ', Habilitado=true):
            // se mandan puestos para que el usuario los vea y pueda cambiarlos.
            const oValores = {};
            this._campos
                .filter(c => !c.auditoria && !c.generado && c.porDefecto !== undefined)
                .forEach(c => { oValores[c.nombre] = c.porDefecto; });

            this._abrirDialogo(this._binding.create(oValores, /* bAtEnd */ false), true);
        },

        onEditar(oEvent) {
            const oItem = (oEvent && oEvent.getParameter && oEvent.getParameter("listItem"))
                || this._tabla.getSelectedItem();

            if (!oItem) return MessageToast.show("Elegí una fila para editar.");
            this._abrirDialogo(oItem.getBindingContext(), false);
        },

        onBorrar() {
            const oItem = this._tabla.getSelectedItem();
            if (!oItem) return MessageToast.show("Elegí una fila para borrar.");

            const oContexto = oItem.getBindingContext();
            MessageBox.confirm("¿Borrar la fila seleccionada?", {
                title: "Confirmar baja",
                emphasizedAction: MessageBox.Action.OK,
                onClose: async (sAccion) => {
                    if (sAccion !== MessageBox.Action.OK) return;
                    try {
                        // "$auto" y no "abm": la baja no pasa por el diálogo, no
                        // hay un Guardar que la confirme después.
                        await oContexto.delete("$auto");
                        MessageToast.show("Fila borrada.");
                        this._actualizarContador();
                    } catch (oError) {
                        this._mostrarError(oError, "No se pudo borrar la fila.");
                    }
                }
            });
        },

        // ── Diálogo ───────────────────────────────────────────────────────

        _abrirDialogo(oContexto, bAlta) {
            this._contextoEdicion = oContexto;
            this._esAlta = bAlta;

            const aEditables = this._campos.filter(c => !c.auditoria && !c.generado);
            const oFormulario = new SimpleForm({
                editable: true,
                layout: "ResponsiveGridLayout",
                labelSpanXL: 4, labelSpanL: 4, labelSpanM: 4, labelSpanS: 12,
                columnsXL: 1, columnsL: 1,
                content: aEditables.reduce((aContenido, c) => aContenido.concat(
                    new Label({
                        text: campos.etiqueta(c),
                        required: c.obligatorio
                    }),
                    // Las keys sólo se cargan en el alta: cambiarlas en una
                    // modificación sería otra fila, no la misma.
                    campos.editor(c, bAlta || !c.clave, this._tablaActual.valoresFijos)
                ), [])
            });

            // Sin id en el diálogo a propósito: con id no se destruye al
            // cerrarse y la segunda apertura queda pegada a la primera.
            this._dialogo = new Dialog({
                title: bAlta
                    ? `Nueva fila — ${this._tablaActual.titulo}`
                    : `Editar — ${this._tablaActual.titulo}`,
                contentWidth: "40rem",
                draggable: true,
                content: [oFormulario],
                beginButton: new Button({
                    text: "Guardar", type: "Emphasized",
                    press: this.onGuardar.bind(this)
                }),
                endButton: new Button({
                    text: "Cancelar",
                    press: this.onCancelar.bind(this)
                }),
                afterClose: (oEvt) => { oEvt.getSource().destroy(); this._dialogo = null; }
            });

            this.getView().addDependent(this._dialogo);
            this._dialogo.setBindingContext(oContexto);
            this._dialogo.open();
        },

        async onGuardar() {
            const oModelo = this.getView().getModel();

            if (Messaging.getMessageModel().getData().some(m => m.validation && m.type === "Error")) {
                return MessageBox.error("Hay campos con errores de formato.");
            }

            const oBoton = this._dialogo.getBeginButton();
            oBoton.setEnabled(false);
            try {
                await oModelo.submitBatch("abm");
                // submitBatch resuelve aunque el request de adentro haya fallado:
                // si el cambio sigue pendiente, el backend lo rechazó.
                if (oModelo.hasPendingChanges("abm")) {
                    throw new Error(this._ultimoMensajeBackend() || "El servidor rechazó el cambio.");
                }
                MessageToast.show(this._esAlta ? "Fila creada." : "Cambios guardados.");
                this._dialogo.close();
                this._actualizarContador();
            } catch (oError) {
                this._mostrarError(oError, "No se pudo guardar.");
            } finally {
                oBoton.setEnabled(true);
            }
        },

        onCancelar() {
            const oModelo = this.getView().getModel();
            if (this._esAlta && this._contextoEdicion.isTransient()) {
                this._contextoEdicion.delete();
            } else {
                oModelo.resetChanges("abm");
            }
            this._dialogo.close();
        },

        // ── Errores ───────────────────────────────────────────────────────

        /**
         * El 403 por falta de rol es el error más probable y el que peor se lee
         * si se lo mezcla con "¿está expuesta la entidad?": la entidad está, lo
         * que falta es la role collection SACDE_CXP_ADMIN asignada al usuario.
         */
        _tituloDeError(oError, sEntidad) {
            const sTexto = `${(oError && oError.status) || ""} ${(oError && oError.message) || ""} ${this._ultimoMensajeBackend()}`;
            if (/\b403\b|lacking required roles|forbidden/i.test(sTexto)) {
                return "No tenés permiso para mantener la parametrización. " +
                    "Pedí que te asignen la role collection SACDE_CXP_ADMIN en BTP Cockpit " +
                    "y volvé a entrar a la app (el token viejo no trae el rol).";
            }
            if (/\b401\b|unauthorized/i.test(sTexto)) {
                return "La sesión venció. Recargá la página para volver a autenticarte.";
            }
            return `No se pudo abrir ${sEntidad}. El detalle de abajo es el error tal cual vino.`;
        },

        /** El texto que mandó el CAP (los req.error de params-service.js). */
        _ultimoMensajeBackend() {
            const aMensajes = Messaging.getMessageModel().getData()
                .filter(m => !m.validation && m.type === "Error");
            return aMensajes.length ? aMensajes[aMensajes.length - 1].message : "";
        },

        _mostrarError(oError, sTitulo) {
            const sDetalle = this._ultimoMensajeBackend() || (oError && oError.message) || "";
            MessageBox.error(sTitulo, { details: sDetalle });
        }
    });
});
