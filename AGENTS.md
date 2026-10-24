# Guía web — EduCraft 2.0

Lee `../AGENTS.md` antes de editar o publicar. Este repositorio es público y estático; la API Go, GPU Agent, Fabric, binarios, secretos y configuraciones internas viven fuera.

## Superficies públicas

- `/`: sitio de EduCraft 2.0.
- `/dashboard/`: shell de gestión autenticada.
- `/remote/login.html`: acceso independiente de alumnado.
- `/remote/`: receptor WebRTC de la sesión aislada.

No publicar tokens, SDP, credenciales, certificados, datos personales, binarios ni topología. Mantener sincronizado el contenido aplicable con `../EduCraft/Web/`. No declarar WebRTC o vinculación Microsoft/Minecraft disponibles sin prueba real verificable.

## Validación estática

```bash
python3 -m http.server 8090 --directory .
curl -I http://127.0.0.1:8090/
curl -I http://127.0.0.1:8090/dashboard/
curl -I http://127.0.0.1:8090/remote/
git diff --check
```

No hacer commit, push ni publicación sin autorización explícita.
