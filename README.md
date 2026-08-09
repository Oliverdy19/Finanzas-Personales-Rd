# Mis cuentas · RD$

App web para llevar presupuesto, ingresos, gastos, deudas y metas de ahorro en pesos
dominicanos. Es la versión en línea del libro de Excel: mismos conceptos, mismos
cálculos, pero accesible desde el celular y con los datos en Supabase.

Sin build, sin `npm install`. Son tres archivos estáticos que GitHub Pages sirve tal cual.

```
index.html                    la app completa (HTML + CSS + JS en un solo archivo)
config.js                     tus claves de Supabase
manifest.json                 datos de la app instalable
sw.js                         service worker
iconos/                       iconos de la pantalla de inicio
schema.sql                    tablas, seguridad, vistas y funciones
migracion_abonos_deuda.sql    pagos de deuda desde Movimientos
```

---

## 1. Crear la base de datos

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto (el plan gratis alcanza de sobra).
2. Abre **SQL Editor › New query**, pega todo el contenido de `schema.sql` y dale **Run**.
3. Repite con `migracion_abonos_deuda.sql`. **En ese orden.**
4. Ambos deben terminar sin errores. Puedes volver a correrlos cuando quieras: son idempotentes.

Lo que queda creado:

| Tabla | Para qué |
|---|---|
| `categorias` | categorías de gasto e ingreso, con color |
| `cuentas` | bancos, efectivo, tarjetas |
| `movimientos` | **la fuente de verdad**: cada ingreso y cada gasto |
| `presupuestos` | monto planificado por categoría y por mes |
| `gastos_fijos` | catálogo de lo recurrente (alquiler, internet, seguros) |
| `deudas` | préstamos y tarjetas |
| `metas` | metas de ahorro |

Más tres vistas que hacen los cálculos en la base, no en el navegador:
`v_resumen_mensual`, `v_gasto_categoria` y `v_presupuesto_vs_real`.

**Seguridad:** todas las tablas tienen RLS activo con la regla `user_id = auth.uid()`.
Cada usuario solo ve y solo puede tocar sus propias filas, aunque alguien tome la clave
anon del repositorio. Las vistas usan `security_invoker = on` para que esa misma regla
siga aplicando a través de ellas.

---

## 2. Configurar el acceso

En Supabase, **Project Settings › API**, copia:

- **Project URL**
- **anon public key**

Pégalas en `config.js`.

Luego en **Authentication › Providers › Email**, decide si quieres confirmación por
correo. Si la dejas activa, en **Authentication › URL Configuration** pon tu dirección
de GitHub Pages como *Site URL*:

```
https://TU-USUARIO.github.io/TU-REPO/
```

Si es para uso personal y no quieres el paso del correo, desactiva
*Confirm email* y podrás entrar apenas creas la cuenta.

---

## 3. Publicar en GitHub Pages

```bash
git init
git add index.html config.js schema.sql README.md
git commit -m "App de finanzas personales"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

En el repositorio: **Settings › Pages › Source: Deploy from a branch › main / (root)**.
En un par de minutos queda en `https://TU-USUARIO.github.io/TU-REPO/`.

Como la navegación usa `#hash`, no hace falta ninguna regla de reescritura ni un
`404.html`. Funciona igual en un subdirectorio.

---

## 4. Primer uso

1. Abre la página y crea tu cuenta con correo y contraseña.
2. Al entrar, la app llama a `inicializar_usuario()` y te crea 20 categorías y 4 cuentas.
3. En **Ajustes › Datos de prueba** puedes cargar tres meses de movimientos ficticios
   para ver cómo se comporta todo. Quedan marcados con la nota `EJEMPLO` y se borran
   todos de un golpe con el botón de al lado.
4. El botón **+** registra un movimiento. Es lo único que necesitas hacer a diario.

---

## Instalarla en el teléfono

Es una PWA: se instala desde el navegador, sin tienda de aplicaciones.

- **Android (Chrome):** entra a la página y toca *Instalar aplicación* en el menú de tres
  puntos. También aparece un botón en **Ajustes › Instalar en el teléfono**.
- **iPhone (Safari):** botón de compartir › *Agregar a inicio*. Tiene que ser Safari;
  Chrome en iOS no puede instalar PWAs.

Queda con su ícono, abre a pantalla completa y arranca al instante.

**Lo que sí funciona sin conexión:** la app abre y te avisa que estás sin señal.
**Lo que no:** tus movimientos viven en Supabase, así que sin internet no hay datos ni se
guardan cambios. Guardarlos en el teléfono exigiría una cola de sincronización con
resolución de conflictos, que es otro proyecto.

Cuando cambies `index.html`, sube el número de `VERSION` en `sw.js`. Si no, los teléfonos
que ya la tengan instalada seguirán con la versión vieja en caché. Al subirlo, la app
muestra un aviso de *Hay una versión nueva* con su botón de actualizar.

### Si más adelante la quieres en Play Store

El mismo código sirve. Dos caminos, sin reescribir nada:

- **Bubblewrap / TWA** (solo Android): empaqueta la PWA como APK. Necesitas verificar el
  dominio, y GitHub Pages no te deja poner el archivo `assetlinks.json` donde hace falta,
  así que tendrías que mover el hosting.
- **Capacitor:** `npm i @capacitor/core @capacitor/cli`, `npx cap init`, copias los
  archivos a `www/`, `npx cap add android`. Da acceso a cámara, notificaciones y biometría,
  y sube a las dos tiendas. Requiere Android Studio y, para iOS, una Mac y la cuenta de
  desarrollador de Apple (US$99 al año).

Para uso personal la PWA alcanza y no cuesta nada.

## Cómo está pensada

- **Movimientos manda.** El resumen, el presupuesto y los gráficos salen todos de ahí.
  Las hojas de gastos fijos y deudas son catálogos: no cuentan como gasto hasta que
  registras el pago (hay un botón *Registrar el pago* que lo hace por ti).
- **Fijo vs. variable** lo decide la casilla "Es un gasto fijo o recurrente" de cada
  movimiento, igual que en el Excel.
- **Los pagos de deuda son movimientos.** Al registrar un gasto puedes elegir a cuál de tus
  deudas se abona, o entrar desde Deudas › *Registrar pago* y el formulario viene precargado
  con la cuota. El saldo baja cuando el movimiento queda en estado **Pagado**; si lo dejas
  en Pendiente, el saldo no se mueve hasta que lo confirmes.
- **El saldo de una deuda se recalcula, no se acumula:**
  `saldo_pendiente = saldo_inicial − abonos pagados`. Por eso el número queda correcto
  aunque edites el monto de un pago, lo desmarques, lo borres o lo cambies a otra deuda.
  Cuando llega a cero, la deuda pasa sola a *Pagada*.
- **Para corregir un saldo a mano** edita la deuda y escribe lo que debes hoy: la función
  `ajustar_saldo_deuda` recalcula el punto de partida sin descuadrar los abonos ya hechos.
- **El presupuesto es por mes.** Cuando entras a un mes nuevo y está vacío, aparece un
  botón para copiar el del mes anterior.
- **Semáforo del presupuesto:** verde por debajo del 80%, ámbar del 80% al 100%,
  vino por encima del 100%.
- Los montos usan `numeric(14,2)`; nada de decimales flotantes en dinero.

## Para trabajar en local

Ábrelo con cualquier servidor estático (abrir el archivo con `file://` también funciona,
pero un servidor evita sorpresas con CORS):

```bash
python3 -m http.server 8080
```

## Si algo falla

| Síntoma | Qué revisar |
|---|---|
| "Falta conectar la base de datos" | `config.js` sigue con los valores de ejemplo |
| Entras pero no aparece nada | ¿Corriste `schema.sql` completo? Revisa el SQL Editor por errores |
| "new row violates row-level security" | La sesión expiró: cierra sesión y vuelve a entrar |
| El correo de confirmación no llega | Desactiva *Confirm email* en Authentication › Providers |
| `Access to manifest… blocked by CORS` con una URL de `github.dev/pf-signin` | Estás en un Codespace con el puerto **privado**. En la pestaña *Ports*, clic derecho sobre el 8080 › *Port Visibility* › **Public**. En GitHub Pages no ocurre |
