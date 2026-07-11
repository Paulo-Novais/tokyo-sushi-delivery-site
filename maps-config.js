// Google Maps deve ser configurado por chave browser restrita no ambiente/host.
// Se o dominio principal mudar, atualize `site.config.json` e os referrers da chave.
const TOKYO_MAPS_GLOBAL_NAME =
  window.TOKYO_SITE_CONFIG?.identifiers?.globalNames?.googleMapsApiKey ||
  "TOKYO_GOOGLE_MAPS_API_KEY";

window[TOKYO_MAPS_GLOBAL_NAME] =
  window[TOKYO_MAPS_GLOBAL_NAME] ||
  window.TOKYO_SITE_CONFIG?.googleMapsApiKey ||
  "";

window.TOKYO_GOOGLE_MAPS_API_KEY = window[TOKYO_MAPS_GLOBAL_NAME];
