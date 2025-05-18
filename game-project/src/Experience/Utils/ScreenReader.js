// src/Experience/Utils/ScreenReader.js
export function narrar(texto) {
  const msg = new SpeechSynthesisUtterance(texto);
  msg.lang = 'es-ES';
  speechSynthesis.cancel(); // detener anteriores
  speechSynthesis.speak(msg);
}
