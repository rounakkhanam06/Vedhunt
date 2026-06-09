export const getCountryFlag = (countryName) => {
  if (!countryName) return '🌐';
  
  const map = {
    'india': '🇮🇳',
    'united states': '🇺🇸',
    'us': '🇺🇸',
    'usa': '🇺🇸',
    'united kingdom': '🇬🇧',
    'uk': '🇬🇧',
    'canada': '🇨🇦',
    'australia': '🇦🇺',
    'germany': '🇩🇪',
    'france': '🇫🇷',
    'italy': '🇮🇹',
    'spain': '🇪🇸',
    'japan': '🇯🇵',
    'china': '🇨🇳',
    'brazil': '🇧🇷',
    'mexico': '🇲🇽',
    'russia': '🇷🇺',
    'south africa': '🇿🇦',
    'uae': '🇦🇪',
    'united arab emirates': '🇦🇪',
    'saudi arabia': '🇸🇦',
    'singapore': '🇸🇬',
    'netherlands': '🇳🇱',
    'switzerland': '🇨🇭',
    'sweden': '🇸🇪',
    'poland': '🇵🇱',
    'argentina': '🇦🇷',
    'new zealand': '🇳🇿',
    'ireland': '🇮🇪'
  };

  const normalized = countryName.toLowerCase().trim();
  return map[normalized] || '🌐';
};
