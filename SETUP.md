# Ejecutar ShopLite con SQLite

## Requisitos

- Node.js LTS instalado. npm se instala junto con Node.js.
- Una terminal abierta en la carpeta del proyecto.

Comprueba las versiones:

```powershell
node --version
npm --version
```

## Instalación y arranque

1. En VS Code, abre la carpeta `ShopLite`.
2. Abre **Terminal > New Terminal** y confirma que la terminal está en la carpeta del proyecto.
3. Instala las dependencias:

   ```powershell
   npm install
   ```

4. Inicia el servidor:

   ```powershell
   npm start
   ```

5. Abre `http://localhost:3000` en el navegador. Express sirve tanto la web como la API; no uses Live Server ni abras `index.html` directamente.
6. Para detener el servidor, vuelve a la terminal y presiona `Ctrl+C`.

## Cuentas de demostración

- Administrador: `admin@shop.com` / `admin123`
- Usuario: `user@shop.com` / `user123`

También puedes registrar una cuenta desde la página de registro. Las contraseñas se guardan con bcrypt.

## Datos persistentes

SQLite crea automáticamente `data/shoplite.sqlite` al iniciar el servidor y carga productos de ejemplo si el catálogo está vacío. Usuarios, productos, carritos y pedidos permanecen en ese archivo aunque se cierre el navegador o se reinicie el servidor. El archivo está excluido de Git.

La sesión de inicio de sesión usa una cookie y, en esta configuración local, se almacena en memoria: al reiniciar el servidor tendrás que iniciar sesión otra vez, pero tus datos de SQLite seguirán ahí.

El checkout es una simulación: no procesa pagos reales ni envía o guarda datos de tarjeta en el servidor.
