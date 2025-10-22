/**
 * Utilitaire pour masquer les URLs dans le texte selon le plan de l'utilisateur
 * Version simplifiée optimisée pour les patterns spécifiques
 */

/**
 * Masque les URLs dans un texte en les remplaçant par des espaces ou des caractères de masquage
 * @param text Le texte à traiter
 * @param hideSources Si true, masque les URLs
 * @returns Le texte avec les URLs masquées si nécessaire
 */
export function maskUrlsInText(text: string, hideSources: boolean): string {
  if (!hideSources || !text) {
    return text;
  }

  let maskedText = text;

  // 1. Masquer les liens markdown [label](url) - AVANT les URLs complètes
  const mdLinkRegex = /\[([^\]]+)\]\(((?:https?:\/\/)[^\s)]+)\)/gi;
  maskedText = maskedText.replace(mdLinkRegex, '[$1]([...])');

  // 2. Masquer les URLs complètes (http/https)
  const httpRegex = /https?:\/\/[^\s)\]}>'"`,]+/gi;
  maskedText = maskedText.replace(httpRegex, '[...]');

  // 3. Masquer les définitions de notes de bas de page: [1]: https://...
  const footnoteDefRegex = /^\[(?:\d+|[a-zA-Z]+)\]:\s*(https?:\/\/[^\s)]+)\s*$/gim;
  maskedText = maskedText.replace(footnoteDefRegex, (match) => {
    return match.replace(/https?:\/\/[^\s)]+/gi, '[...]');
  });

  // 4. Masquer les citations inline: [1] Title (https://...)
  const inlineCitationRegex = /\[(?:\d+|[a-zA-Z]+)\][^\n]*?\((https?:\/\/[^\s)]+)\)/gim;
  maskedText = maskedText.replace(inlineCitationRegex, (match, url) => {
    return match.replace(url, '[...]');
  });

  // 5. Masquer les domaines entre parenthèses: (example.com), (vogue.co.uk)
  // Pattern optimisé pour les exemples fournis
  const parenthesizedDomainRegex = /\([^)]*\.[^)]+\)/g;
  maskedText = maskedText.replace(parenthesizedDomainRegex, '([...])');

  // 6. Masquer les domaines nus (éviter les emails)
  const bareDomainRegex = /\b(?!mailto:)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\.[a-z]{2,})(?:\/[\w\-._~:\/?#[\]@!$&'()*+,;=%]*)?)\b/gi;
  maskedText = maskedText.replace(bareDomainRegex, (match) => {
    // Vérifier que c'est bien une URL (contient un point et au moins 2 caractères après)
    if (match.includes('.') && match.length > 3) {
      return '[...]';
    }
    return match;
  });

  return maskedText;
}

/**
 * Vérifie si un texte contient des URLs
 * @param text Le texte à vérifier
 * @returns true si le texte contient des URLs
 */
export function containsUrls(text: string): boolean {
  if (!text) return false;

  const httpRegex = /https?:\/\/[^\s)\]}>'"`]+/gi;
  const mdLinkRegex = /\[[^\]]+\]\(((?:https?:\/\/)[^\s)]+)\)/gi;
  const footnoteDefRegex = /^\[(?:\d+|[a-zA-Z]+)\]:\s*(https?:\/\/[^\s)]+)\s*$/gim;
  const inlineCitationRegex = /\[(?:\d+|[a-zA-Z]+)\][^\n]*?\((https?:\/\/[^\s)]+)\)/gim;
  const parenthesizedDomainRegex = /\([^)]*\.[^)]+\)/g;
  const bareDomainRegex = /\b(?!mailto:)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\.[a-z]{2,})(?:\/[\w\-._~:\/?#[\]@!$&'()*+,;=%]*)?)\b/gi;

  return (
    httpRegex.test(text) ||
    mdLinkRegex.test(text) ||
    footnoteDefRegex.test(text) ||
    inlineCitationRegex.test(text) ||
    parenthesizedDomainRegex.test(text) ||
    bareDomainRegex.test(text)
  );
}

/**
 * Extrait les URLs d'un texte sans les masquer (pour usage interne)
 * @param text Le texte à analyser
 * @returns Liste des URLs trouvées
 */
export function extractUrlsForMasking(text: string): string[] {
  if (!text) return [];

  const urls: string[] = [];

  // URLs complètes
  const httpRegex = /https?:\/\/[^\s)\]}>'"`]+/gi;
  const httpMatches = text.match(httpRegex) || [];
  urls.push(...httpMatches);

  // Liens markdown
  const mdLinkRegex = /\[[^\]]+\]\(((?:https?:\/\/)[^\s)]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = mdLinkRegex.exec(text)) !== null) {
    if (m[1]) urls.push(m[1]);
  }

  // Définitions de notes de bas de page
  const footnoteDefRegex = /^\[(?:\d+|[a-zA-Z]+)\]:\s*(https?:\/\/[^\s)]+)\s*$/gim;
  while ((m = footnoteDefRegex.exec(text)) !== null) {
    if (m[1]) urls.push(m[1]);
  }

  // Citations inline
  const inlineCitationRegex = /\[(?:\d+|[a-zA-Z]+)\][^\n]*?\((https?:\/\/[^\s)]+)\)/gim;
  while ((m = inlineCitationRegex.exec(text)) !== null) {
    if (m[1]) urls.push(m[1]);
  }

  // Domaines entre parenthèses
  const parenthesizedDomainRegex = /\([^)]*\.[^)]+\)/g;
  const parenthesizedMatches = text.match(parenthesizedDomainRegex) || [];
  urls.push(...parenthesizedMatches);

  // Domaines nus
  const bareDomainRegex = /\b(?!mailto:)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\.[a-z]{2,})(?:\/[\w\-._~:\/?#[\]@!$&'()*+,;=%]*)?)\b/gi;
  const domainMatches = (text.match(bareDomainRegex) || []).filter((s) => s.includes('.') && s.length > 3);
  urls.push(...domainMatches);

  // Nettoyer et dédupliquer
  const cleaned = urls
    .map((u) => u.replace(/[),.;:!?]+$/g, ''))
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const u of cleaned) {
    const key = u.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(u);
    }
  }

  return result;
}