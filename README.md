# SACDE-CXP-ABM-Params

ABM de las tablas paramétricas del Portal de Cuentas a Pagar. Es el reemplazo
del SM30: cuando las tablas Z se portaron de S/4 a HANA (Clean Core), se
quedaron sin transacción de mantenimiento y la única forma de tocarlas era
recargar el CSV de `db/data` o editar la tabla desde HANA Cloud Central.

## Cómo está partido

| Dónde | Qué |
|---|---|
| `SACDE-Cuentas-x-Pagar-CAP/srv/params-service.cds` | Servicio OData V4 `CxpParamsService`, en `/odata/v4/cxp-params`, con las 10 entidades |
| `SACDE-Cuentas-x-Pagar-CAP/srv/params-service.js` | Validaciones (lo que en S/4 hacían los dominios y los checks de tabla) e invalidación del cache de contexto |
| `SACDE-CXP-ABM-Params` (este MTA) | La app UI5 |

El backend vive en el CAP del portal y no en un módulo propio: son las mismas
tablas del mismo contenedor HDI. Un CAP aparte tendría que compartir el HDI
container o duplicar el modelo.

Servicio separado de `CuentasXPagarService` a propósito: ese se expone a
proveedores externos, este no. Un solo `@requires: 'CxpAdmin'` deja toda la
parametrización detrás del rol.

## Tablas

Con ABM completo: `Parametrizacion` (fila única DEFAULT) · `ParamRangos` ·
`BlartMapeo` · `CatalogoImpuestos` · `PadronPercepciones` · `Fce` ·
`TipoComprobante` · `Impersonar`

Solo consulta (`@readonly` en el servicio, sin botones en la app):

- `UsuariosPortal` — el mapeo mail ↔ proveedor lo resuelven el IAS y el core
  ABAP (`ZUS0_PORTAL_PROV` / `ZUS1_PORTAL_PROV`). Esta tabla quedó sin
  consumidores el 26/08/2026 y nunca llegó a tener datos; está anotada como
  pendiente de borrar del schema.
- `UsuariosPortalEstado` — la escribe `registrarIngreso` en cada login y la lee
  `ListarUsuariosSet` para pisar `fechaLogueo`/`cuentaValidada`, que S/4 no
  conoce. Viva, pero es auditoría: editarla a mano sería falsearla.

## Cómo funciona la app

No hay una vista por tabla. Las columnas, los tipos, las keys y los
obligatorios salen del `$metadata` del servicio (`webapp/model/campos.js`).
Exponer una entidad nueva en `params-service.cds` alcanza para que aparezca en
la app con su ABM; `webapp/model/tablas.js` sólo le agrega el nombre en
castellano, la descripción y los combos de valores fijos.

Los cambios del diálogo van a un grupo diferido (`abm`): nada viaja al servidor
hasta el Guardar, y Cancelar los descarta. Las keys se cargan sólo en el alta —
cambiar una key en una modificación sería otra fila, no la misma.

## Desplegar

1. **CAP primero.** `xs-security.json` cambió (scope `CxpAdmin` nuevo), así que
   el deploy tiene que actualizar el service instance de XSUAA:
   ```
   cd ../SACDE-Cuentas-x-Pagar-CAP && mbt build && cf deploy mta_archives/<...>.mtar
   ```
2. **Asignar la role collection `SACDE_CXP_ADMIN`** en BTP Cockpit a quien vaya
   a mantener la parametrización. Sin eso, la app abre y todas las llamadas
   vuelven 403.
3. **La app:**
   ```
   mbt build && cf deploy mta_archives/SACDE-CXP-ABM-Params_0.0.1.mtar
   ```
4. Agregar el tile en Work Zone (inbound `sacdecxpabmparamsui5-display`).

Depende de la destination `CAP_SACDE_CUENTAS_POR_PAGAR`, la misma que ya usan
las otras apps del portal.

## Desarrollo local

```
cd ../SACDE-Cuentas-x-Pagar-CAP && cds watch      # levanta en :4004
cd sacde-cxp-abm-params-ui5 && npm start
```

El proxy de `ui5.yaml` manda `/odata/v4/cxp-params` a `localhost:4004`. En local
la auth es `mocked`, así que hace falta un usuario con el rol:

```
CDS_REQUIRES_AUTH_USERS='{"paramadmin":{"roles":["CxpAdmin"]}}' cds watch
```

## Lo que hay que saber antes de tocar esto

- **El cache de contexto es de proceso.** Guardar invalida el cache de la
  instancia que atendió el request, no el de las demás. Con más de una instancia
  del `srv`, un cambio puede tardar hasta 10 minutos (el TTL) en verse en el
  portal. Es el techo que ya tenía el sistema, no uno nuevo.
- **`ParamRangos.Campo` es una lista cerrada.** El serializador arma los rangos
  recorriendo `CAMPOS_RANGO` de `srv/utils/contexto.js`, no la tabla: una fila
  con un Campo que no está en esa lista se graba y no la lee nadie. Por eso el
  backend la rechaza.
- **`valoresFijos` de `tablas.js` es un espejo del backend.** Es sólo UX. Si en
  `params-service.js` se agrega un valor permitido, hay que agregarlo también
  allá o el combo no lo va a ofrecer.
- **`Impersonar` acá sí se expone.** `db/schema.cds` dice que no va por OData:
  esa regla es para `CuentasXPagarService`, donde el que llama puede ser un
  proveedor y podría auto-asignarse otro CUIT. Acá el servicio entero pide
  `CxpAdmin`, y la tabla sigue sin hacer nada salvo que `IMPERSONACION_ACTIVA`
  esté en `'true'`.
- **Las clases de documento de `BlartMapeo` siguen sin definición de Negocio.**
  La app permite cargarlas, pero los valores definitivos todavía no llegaron.
