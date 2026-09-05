/* Explicit lifecycle: only the Minecraft login screen may show the widget.
 * API: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 */
(function () {
 "use strict";
 var active = false, token = "", widgetId = null, bounds = null;
 var generation = 0, scriptLoading = false;
 function panel() { return document.getElementById("educraft_turnstile_panel"); }
 function status(message, visible) {
  var node = document.getElementById("educraft_turnstile_status");
  node.textContent = message;
  node.hidden = !visible;
 }
 function position() {
  if (!active || !bounds) return;
  var canvas = document.querySelector("#game_frame canvas");
  var frame = canvas || document.getElementById("game_frame");
  var rect = frame.getBoundingClientRect();
  var sx = rect.width / bounds.guiWidth, sy = rect.height / bounds.guiHeight;
  var scale = Math.min(bounds.width * sx / 300, bounds.height * sy / 65);
  var node = panel();
  node.style.left = (rect.left + bounds.x * sx + (bounds.width * sx - 300 * scale) / 2) + "px";
  node.style.top = (rect.top + bounds.y * sy + (bounds.height * sy - 65 * scale) / 2) + "px";
  node.style.transform = "scale(" + scale + ")";
 }
 function render() {
  if (!active || widgetId !== null || !window.turnstile) return;
  var sitekey = window.EDUCRAFT_TURNSTILE_SITE_KEY;
  if (!sitekey) { status("La verificación no está configurada.", true); return; }
  var epoch = generation;
  try {
   widgetId = window.turnstile.render("#educraft_turnstile", {
    sitekey: sitekey, action: "login", theme: "dark", size: "normal",
    callback: function (value) {
     if (!active || epoch !== generation) return;
     token = value || "";
     status("Verificación completada.", false);
    },
    "expired-callback": function () {
     if (!active || epoch !== generation) return;
     token = "";
     status("La verificación ha caducado.", false);
    },
    "error-callback": function () {
     if (!active || epoch !== generation) return;
     token = "";
     status("No se pudo verificar. Reintenta o recarga la página.", false);
    }
   });
   // The widget supplies its own visible progress, success and error messages.
   status("Verificación de seguridad.", false);
  } catch (e) {
   status("No se pudo cargar la verificación. Recarga la página.", true);
  }
 }
 function load() {
  if (window.turnstile) { render(); return; }
  if (scriptLoading) return;
  scriptLoading = true;
  var script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.onload = function () { scriptLoading = false; render(); };
  script.onerror = function () {
   scriptLoading = false;
   script.remove();
   if (active) status("No se pudo cargar Cloudflare. Recarga la página.", true);
  };
  document.head.appendChild(script);
 }
 window.EDUCRAFT_showTurnstile = function (x, y, width, height, guiWidth, guiHeight) {
  bounds = { x: x, y: y, width: width, height: height, guiWidth: guiWidth, guiHeight: guiHeight };
  active = true;
  panel().hidden = false;
  position();
  load();
 };
 window.EDUCRAFT_getTurnstileToken = function () { return active ? token : ""; };
 window.EDUCRAFT_resetTurnstile = function () {
  token = "";
  if (!active) return;
  if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
  else load();
 };
 window.EDUCRAFT_hideTurnstile = function () {
  active = false;
  token = "";
  ++generation;
  panel().hidden = true;
  if (window.turnstile && widgetId !== null) window.turnstile.remove(widgetId);
  widgetId = null;
  status("Preparando verificación…", true);
 };
 window.addEventListener("resize", position);
 document.addEventListener("fullscreenchange", position);
}());
