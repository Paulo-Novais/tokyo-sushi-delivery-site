// Se o dominio principal mudar, atualize `site.config.json`
// e libere os novos referers na chave do Google Maps.
const TOKYO_MAPS_GLOBAL_NAME =
  window.TOKYO_SITE_CONFIG?.identifiers?.globalNames?.googleMapsApiKey ||
  "TOKYO_GOOGLE_MAPS_API_KEY";

window[TOKYO_MAPS_GLOBAL_NAME] =
  window[TOKYO_MAPS_GLOBAL_NAME] ||
  window.TOKYO_SITE_CONFIG?.googleMapsApiKey ||
  "AIzaSyBHg4IxMAZGhQbke0CTNB0sB8kk4z2AkY8";

window.TOKYO_GOOGLE_MAPS_API_KEY = window[TOKYO_MAPS_GLOBAL_NAME];
