# EduCraft 2.0 Web

Sitio estático público, shells de dashboard y cliente remoto de EduCraft 2.0.

## Rutas

- `/`: web pública.
- `/dashboard/`: acceso general para administración, centros y profesorado.
- `/remote/login.html`: acceso separado de alumnado al cliente remoto.
- `/remote/`: receptor WebRTC de sesión gráfica aislada.

Los datos dinámicos viven en la API privada. Este repositorio nunca debe incluir código Go, binarios, tokens, credenciales de GPU Agent/Fabric, secretos OAuth ni topología interna.

El receptor WebRTC y la señalización del navegador están implementados localmente, pero la primera reproducción visual H.264 en navegador todavía no está verificada. No anunciarla como disponible hasta demostrar `framesDecoded` y la imagen real.

Cuando se modifique web pública, sincronizar el espejo privado `../EduCraft/Web/` y validar con un servidor estático local. No publicar ni desplegar sin autorización explícita.
