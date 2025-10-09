import { useState, useCallback } from 'react';
import type { BrandDetectionResult, BrandDetectionOptions } from '@/lib/brand-detection-service';

interface BrandDetectionError {
  message: string;
  code?: string;
  details?: string;
  brandName?: string;
  brandNames?: string[];
}

interface UseBrandDetectionReturn {
  detectBrandMentions: (text: string, brandName: string, options?: BrandDetectionOptions) => Promise<BrandDetectionResult>;
  detectMultipleBrands: (text: string, brandNames: string[], options?: BrandDetectionOptions) => Promise<Map<string, BrandDetectionResult>>;
  isLoading: boolean;
  error: BrandDetectionError | null;
  clearError: () => void;
}

export function useBrandDetection(): UseBrandDetectionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<BrandDetectionError | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const detectBrandMentions = useCallback(async (
    text: string, 
    brandName: string, 
    options: BrandDetectionOptions = {}
  ): Promise<BrandDetectionResult> => {
    setIsLoading(true);
    setError(null);
    
    // Validation des paramètres côté client
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      const error: BrandDetectionError = {
        message: 'Le texte fourni est invalide',
        code: 'INVALID_TEXT',
        details: 'Le texte doit être une chaîne non vide',
        brandName
      };
      setError(error);
      setIsLoading(false);
      throw new Error(error.message);
    }

    if (!brandName || typeof brandName !== 'string' || brandName.trim().length === 0) {
      const error: BrandDetectionError = {
        message: 'Le nom de marque fourni est invalide',
        code: 'INVALID_BRAND_NAME',
        details: 'Le nom de marque doit être une chaîne non vide'
      };
      setError(error);
      setIsLoading(false);
      throw new Error(error.message);
    }
    
    try {
      console.log(`[useBrandDetection] Détection de marque: "${brandName}" dans un texte de ${text.length} caractères`);
      
      const response = await fetch('/api/brand-detection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          brandNames: brandName,
          options
        }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Erreur de communication avec le serveur' };
        }

        const error: BrandDetectionError = {
          message: errorData.error || 'Échec de la détection de marque',
          code: errorData.code,
          details: errorData.details,
          brandName
        };
        
        console.error(`[useBrandDetection] Erreur API (${response.status}):`, error);
        setError(error);
        throw new Error(error.message);
      }

      const result = await response.json();
      console.log(`[useBrandDetection] Détection réussie pour "${brandName}": ${result.mentioned ? 'mentionnée' : 'non mentionnée'}`);
      return result;
    } catch (err) {
      // Si l'erreur n'a pas déjà été définie par la gestion des erreurs API
      if (!error) {
        const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
        const networkError: BrandDetectionError = {
          message: 'Erreur de réseau ou de communication',
          code: 'NETWORK_ERROR',
          details: errorMessage,
          brandName
        };
        console.error(`[useBrandDetection] Erreur réseau pour "${brandName}":`, err);
        setError(networkError);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const detectMultipleBrands = useCallback(async (
    text: string, 
    brandNames: string[], 
    options: BrandDetectionOptions = {}
  ): Promise<Map<string, BrandDetectionResult>> => {
    setIsLoading(true);
    setError(null);
    
    // Validation des paramètres côté client
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      const error: BrandDetectionError = {
        message: 'Le texte fourni est invalide',
        code: 'INVALID_TEXT',
        details: 'Le texte doit être une chaîne non vide',
        brandNames
      };
      setError(error);
      setIsLoading(false);
      throw new Error(error.message);
    }

    if (!Array.isArray(brandNames) || brandNames.length === 0) {
      const error: BrandDetectionError = {
        message: 'La liste des marques fournie est invalide',
        code: 'INVALID_BRAND_NAMES',
        details: 'La liste des marques doit être un tableau non vide'
      };
      setError(error);
      setIsLoading(false);
      throw new Error(error.message);
    }

    const invalidBrands = brandNames.filter(name => typeof name !== 'string' || !name.trim());
    if (invalidBrands.length > 0) {
      const error: BrandDetectionError = {
        message: 'Certains noms de marques sont invalides',
        code: 'INVALID_BRAND_ARRAY',
        details: `Trouvé ${invalidBrands.length} noms de marques invalides`,
        brandNames
      };
      setError(error);
      setIsLoading(false);
      throw new Error(error.message);
    }
    
    try {
      console.log(`[useBrandDetection] Détection de ${brandNames.length} marques dans un texte de ${text.length} caractères`);
      
      const response = await fetch('/api/brand-detection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          brandNames,
          options
        }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Erreur de communication avec le serveur' };
        }

        const error: BrandDetectionError = {
          message: errorData.error || 'Échec de la détection de marques multiples',
          code: errorData.code,
          details: errorData.details,
          brandNames
        };
        
        console.error(`[useBrandDetection] Erreur API (${response.status}):`, error);
        setError(error);
        throw new Error(error.message);
      }

      const resultsObject = (await response.json()) as Record<string, BrandDetectionResult>;
      // Convert Object back to Map with proper typing
      const results = new Map<string, BrandDetectionResult>(Object.entries(resultsObject));
      console.log(`[useBrandDetection] Détection multiple réussie: ${results.size} marques traitées`);
      return results;
    } catch (err) {
      // Si l'erreur n'a pas déjà été définie par la gestion des erreurs API
      if (!error) {
        const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
        const networkError: BrandDetectionError = {
          message: 'Erreur de réseau ou de communication',
          code: 'NETWORK_ERROR',
          details: errorMessage,
          brandNames
        };
        console.error(`[useBrandDetection] Erreur réseau pour ${brandNames.length} marques:`, err);
        setError(networkError);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    detectBrandMentions,
    detectMultipleBrands,
    isLoading,
    error,
    clearError
  };
}
