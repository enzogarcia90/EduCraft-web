# EduCraft Web Agent Guide

Este repo es publico y estatico. Solo contiene la web publica, el dashboard shell, el cliente ya compilado y assets publicos para GitHub Pages.

## Limites duros

No subas aqui backend, `.env`, tokens, webhooks, certificados, dumps, binarios privados, configuracion interna ni archivos del servidor. El backend Go y los plugins viven en el repo privado `EduCraft`.

## Rutas y deploy

URL publica:

```text
https://enzogarcia90.github.io/EduCraft-web/
https://enzogarcia90.github.io/EduCraft-web/cliente/
```

Este repo no tiene build Node. Validacion local:

```bash
python3 -m http.server 8090 --directory .
curl -I http://127.0.0.1:8090/
curl -I http://127.0.0.1:8090/dashboard/
curl -I http://127.0.0.1:8090/cliente/
git diff --check
```

Publicacion:

```bash
git fetch origin
git status --short --branch
git add <archivos>
git commit -m "Mensaje claro"
git push origin main
```

Despues de `git push`, espera a GitHub Pages. Un 404 justo despues del push puede ser solo workflow en progreso.

## Espejo privado

Cuando cambies web publica o dashboard, sincroniza el espejo privado:

```text
/var/home/enzo/Escritorio/VSC/Educraft/EduCraft/Web
```

Compara con:

```bash
diff -qr /var/home/enzo/Escritorio/VSC/Educraft/EduCraft-web/dashboard /var/home/enzo/Escritorio/VSC/Educraft/EduCraft/Web/dashboard
```

## Cliente

El cliente no se compila aqui. Se compila desde el repo privado `EduCraft` y se copia aqui como archivos estaticos bajo `cliente/`.

Config publica de API:

```text
cliente/educraft-config.js
window.EDUCRAFT_API_BASE_URL = "https://educraftes.duckdns.org";
```

No declares el cliente actualizado si solo cambiaste imagenes sueltas. Compara hashes/tamanos de `assets.epw` contra el build original y Pages.

## Checklist antes de cerrar

- `git status --short --branch` revisado.
- `git diff --check` sin errores.
- Rutas estaticas principales responden localmente.
- Cambios sincronizados al espejo privado si aplica.
- No hay secretos nuevos en archivos trackeados.
