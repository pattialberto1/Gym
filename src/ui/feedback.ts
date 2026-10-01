// Vibración y notificaciones del entreno (mejora progresiva: si no hay soporte, no pasa nada).

export function vibrar(patron: number | number[]): void {
  try {
    navigator.vibrate?.(patron);
  } catch {
    /* sin soporte */
  }
}

export function reduceMovimiento(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function notificacionesDisponibles(): boolean {
  return "Notification" in window && "serviceWorker" in navigator;
}

export async function pedirPermisoNotificaciones(): Promise<boolean> {
  if (!notificacionesDisponibles()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export const ETIQUETA_NOTIFICACION = "entreno";

/** Notificación persistente con la serie actual y la acción "Hecha". */
export async function notificarSerie(titulo: string, cuerpo: string, avisar: boolean): Promise<void> {
  if (!notificacionesDisponibles() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const opciones: NotificationOptions & { actions?: { action: string; title: string }[]; renotify?: boolean } = {
    body: cuerpo,
    tag: ETIQUETA_NOTIFICACION,
    renotify: avisar,
    silent: !avisar,
    requireInteraction: true,
    icon: import.meta.env.BASE_URL + "iconos/icono-192.png",
    badge: import.meta.env.BASE_URL + "iconos/icono-192.png",
    data: { url: location.href.split("#")[0] + "#/entreno" },
    actions: [{ action: "hecha", title: "Hecha ✓" }],
  };
  await reg.showNotification(titulo, opciones);
}

export async function cerrarNotificacion(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const lista = (await reg?.getNotifications({ tag: ETIQUETA_NOTIFICACION })) ?? [];
  lista.forEach((n) => n.close());
}
