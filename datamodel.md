# Modelo de datos de ShopLite

## 1. Persistencia

ShopLite sirve su interfaz y API desde Node.js/Express. `db.js` es el cliente HTTP del navegador; `server.js` es la capa que valida operaciones y accede a SQLite. La base de datos persistente se crea en `data/shoplite.sqlite`.

Las siguientes tablas corresponden al esquema SQL real creado automáticamente por `server.js`. Los identificadores son enteros autoincrementales y las marcas de tiempo se guardan como texto generado por SQLite.

| Tabla | Propósito |
| --- | --- |
| `users` | Cuentas y hashes de contraseña |
| `products` | Catálogo e inventario |
| `cart_items` | Carrito por usuario y producto |
| `orders` | Encabezado de pedidos y dirección de envío |
| `order_items` | Líneas de artículos comprados |

## 2. Tablas de negocio

Los tipos corresponden a SQLite. La API convierte las columnas a objetos JSON para el navegador.

### `users`

| Campo | Tipo | Restricciones / descripción |
| --- | --- | --- |
| `id` | `INTEGER` | PK autoincremental. |
| `name` | `TEXT` | Nombre mostrado del usuario. |
| `email` | `TEXT` | Correo único; la comprobación de duplicados no distingue mayúsculas de minúsculas. |
| `password_hash` | `TEXT` | Hash bcrypt; nunca se guarda la contraseña original. |
| `role` | `TEXT` | `admin` o `user`; predeterminado `user`. |
| `created_at` | `TEXT` | Fecha y hora UTC generada por SQLite. |

### `products`

| Campo | Tipo | Restricciones / descripción |
| --- | --- | --- |
| `id` | `INTEGER` | PK autoincremental. |
| `name` | `TEXT` | Nombre del producto. |
| `description` | `TEXT` | Descripción del producto. |
| `price` | `REAL` | Precio unitario. |
| `stock` | `INTEGER` | Unidades disponibles; al comprar se reduce, sin bajar de cero. |
| `category` | `TEXT` | Categoría del producto. |
| `image` | `TEXT` | URL de la imagen. |
| `created_at` | `TEXT` | Fecha y hora UTC generada por SQLite. |

### `cart_items`

| Campo | Tipo | Restricciones / descripción |
| --- | --- | --- |
| `user_id` | `INTEGER` | PK compuesta y FK a `users.id`, con borrado en cascada. |
| `product_id` | `INTEGER` | PK compuesta y FK a `products.id`, con borrado en cascada. |
| `qty` | `INTEGER` | Cantidad positiva del producto. |

Clave primaria compuesta: (`user_id`, `product_id`).

### `orders`

| Campo | Tipo | Restricciones / descripción |
| --- | --- | --- |
| `id` | `INTEGER` | PK autoincremental. |
| `user_id` | `INTEGER` | FK a `users.id`. |
| `subtotal` | `REAL` | Importe de los artículos antes de impuestos y envío. |
| `tax` | `REAL` | Impuesto calculado en el servidor. |
| `shipping` | `REAL` | Costo de envío. |
| `total` | `REAL` | Total: subtotal + impuesto + envío. |
| `status` | `TEXT` | Estado; valor predeterminado `paid` (pago simulado). |
| `shipping_full_name` | `TEXT` | Nombre del destinatario. |
| `shipping_address` | `TEXT` | Dirección. |
| `shipping_city` | `TEXT` | Ciudad. |
| `shipping_zip` | `TEXT` | Código postal. |
| `shipping_country` | `TEXT` | País. |
| `created_at` | `TEXT` | Fecha y hora UTC generada por SQLite. |

### `order_items`

| Campo | Tipo | Restricciones / descripción |
| --- | --- | --- |
| `id` | `INTEGER` | PK autoincremental. |
| `order_id` | `INTEGER` | FK a `orders.id`, con borrado en cascada. |
| `product_id` | `INTEGER` | FK a `products.id`; pasa a `NULL` si se elimina el producto. |
| `name` | `TEXT` | Nombre copiado como instantánea histórica. |
| `price` | `REAL` | Precio unitario copiado como instantánea histórica. |
| `qty` | `INTEGER` | Cantidad positiva comprada. |

## 3. Sesión y datos iniciales

La sesión de autenticación usa una cookie `shoplite.sid` HTTP-only administrada por `express-session`. En el modo local, los datos de sesión están en memoria y se pierden al reiniciar el servidor; las cuentas, productos y pedidos permanecen en SQLite. `sessionStorage.lastOrderId` guarda temporalmente el ID para la página de confirmación.

El servidor crea los productos de ejemplo si la tabla `products` está vacía. También crea, si no existen, las cuentas demo `admin@shop.com` (rol `admin`) y `user@shop.com` (rol `user`), con contraseñas `admin123` y `user123` almacenadas mediante bcrypt.

## 4. Relaciones y comportamiento

- Un usuario puede tener muchos pedidos y artículos de carrito: `orders.user_id` y `cart_items.user_id` referencian `users.id`.
- Un carrito tiene como máximo una fila por combinación de usuario y producto.
- `order_items` separa las líneas de compra del encabezado del pedido. Guarda el nombre y precio del momento de compra, aunque posteriormente se edite o elimine el producto.
- Las claves foráneas están habilitadas. Eliminar un producto borra sus filas de carrito y conserva pedidos anteriores con `order_items.product_id = NULL`.
- El checkout valida stock y calcula importes en el servidor dentro de una transacción: impuesto 8 %, envío 5.00 si subtotal < 75.00 y gratis desde 75.00. En la misma transacción registra las líneas, reduce stock y vacía el carrito.
- El pago sigue siendo simulado. El servidor no recibe ni almacena número de tarjeta, vencimiento, CVV ni últimos dígitos.
- `data/shoplite.sqlite` contiene los datos persistentes y está excluido de Git. No se debe usar el secreto de sesión predeterminado ni el almacén de sesiones en memoria en un despliegue público.

## 5. Archivos principales

- `server.js`: esquema SQLite, datos iniciales, autenticación y endpoints de la API.
- `db.js`: cliente `fetch` del navegador para la API.
- `checkout.js`: formulario de envío y envío de la solicitud de pedido.
- `admin.js`: administración del catálogo, usuarios y pedidos.