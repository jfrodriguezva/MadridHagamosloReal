"use client";

// Puente hacia la app de escritorio WPF (WebView2). Cuando el portal corre
// dentro de la app nativa, window.chrome.webview existe y podemos pedirle
// que abra selectores de archivo nativos de Windows -- 100% local, nunca
// sube nada. Fuera de WPF (navegador normal) no hay selector nativo posible
// por seguridad del navegador, así que se usa un <input type="file"> normal.
//
// `url` es un host virtual https://mediaN.local/archivo.mp4 que WPF mapea a la
// carpeta real del archivo -- así el navegador (y ffmpeg.wasm, que necesita
// leer bytes reales con fetch) lo puede cargar como cualquier recurso web,
// sin los líos de permisos de file://.

type BridgeMessage = { type: string; path: string | null; name: string | null; url: string | null };
export type PickedFile = { path: string; name: string; url: string };

declare global {
  interface Window {
    chrome?: {
      webview?: {
        postMessage: (msg: unknown) => void;
        addEventListener: (event: "message", cb: (e: MessageEvent) => void) => void;
        removeEventListener: (event: "message", cb: (e: MessageEvent) => void) => void;
      };
    };
  }
}

export function isWpfHost(): boolean {
  return typeof window !== "undefined" && !!window.chrome?.webview;
}

function pickViaBridge(requestType: "pickVideoFile" | "pickImageFile"): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const webview = window.chrome!.webview!;
    const expectedType = requestType === "pickVideoFile" ? "videoFilePicked" : "imageFilePicked";
    const handler = (e: MessageEvent) => {
      const data = e.data as BridgeMessage;
      if (data?.type !== expectedType) return;
      webview.removeEventListener("message", handler);
      resolve(data.path && data.name && data.url ? { path: data.path, name: data.name, url: data.url } : null);
    };
    webview.addEventListener("message", handler);
    webview.postMessage({ type: requestType });
  });
}

// --- Control flotante de grabación -----------------------------------------
// La píldora de "grabando" existe además como ventana nativa always-on-top
// (desktop/RecordingOverlay.cs) porque tiene que seguir visible y clicable
// cuando el usuario se va a OTRA aplicación a grabar -- eso el navegador no lo
// puede hacer. La página sigue siendo la dueña del MediaRecorder: solo le
// reporta el estado al shell y obedece los botones que este le reenvía.

export type RecordingCommand = "stop" | "pause" | "resume";

export function notifyRecordingStarted(): void {
  window.chrome?.webview?.postMessage({ type: "recordingStarted" });
}

export function notifyRecordingState(seconds: number, paused: boolean, micLevel: number): void {
  window.chrome?.webview?.postMessage({ type: "recordingState", seconds, paused, micLevel });
}

export function notifyRecordingStopped(): void {
  window.chrome?.webview?.postMessage({ type: "recordingStopped" });
}

/** Devuelve la función para dejar de escuchar. */
export function onRecordingCommand(cb: (command: RecordingCommand) => void): () => void {
  const webview = window.chrome?.webview;
  if (!webview) return () => {};
  const handler = (e: MessageEvent) => {
    const data = e.data as { type?: string; command?: RecordingCommand };
    if (data?.type === "recordingCommand" && data.command) cb(data.command);
  };
  webview.addEventListener("message", handler);
  return () => webview.removeEventListener("message", handler);
}

export function pickVideoFile(): Promise<PickedFile | null> {
  if (!isWpfHost()) return Promise.resolve(null);
  return pickViaBridge("pickVideoFile");
}

export function pickImageFile(): Promise<PickedFile | null> {
  if (!isWpfHost()) return Promise.resolve(null);
  return pickViaBridge("pickImageFile");
}
