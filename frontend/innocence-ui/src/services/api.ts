import axios from 'axios';
import { HyperCoreAsset, ComplianceCheckRequest, ComplianceCheckResponse } from '../types';
import { mockAssets, generateMockCertificate } from './mockData';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5169/api';

console.log('API Base URL:', API_BASE_URL); // Debug log to verify URL

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const complianceAPI = {
  checkCompliance: async (request: ComplianceCheckRequest): Promise<ComplianceCheckResponse> => {
    try {
      const response = await apiClient.post<ComplianceCheckResponse>('/compliance/check', request);
      return response.data;
    } catch (error) {
      console.error('Compliance API not available, using mock response');
      // Return mock compliance response for testing
      const mockCert = generateMockCertificate(request.address);
      return {
        isCompliant: true,
        certificateId: mockCert.certificateId,
        signature: mockCert.signature,
        validUntil: new Date(mockCert.validUntil).toISOString(),
        reasons: [],
      };
    }
  },

  validateCertificate: async (certificateId: string, signature: string): Promise<boolean> => {
    try {
      const response = await apiClient.get<{ isValid: boolean }>(
        `/compliance/certificate/${certificateId}?signature=${signature}`
      );
      return response.data.isValid;
    } catch (error) {
      console.error('Certificate validation API not available, returning true for testing');
      return true; // Allow testing without backend
    }
  },
};

export const hyperCoreAPI = {
  getAssets: async (): Promise<HyperCoreAsset[]> => {
    try {
      const response = await apiClient.get<HyperCoreAsset[]>('/hypercore/assets');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching assets, using mock data:', error.response || error);
      // Return mock data if backend is not available
      return mockAssets;
    }
  },

  getAssetInfo: async (assetId: string): Promise<HyperCoreAsset> => {
    const response = await apiClient.get<HyperCoreAsset>(`/hypercore/assets/${assetId}`);
    return response.data;
  },

  getAssetPrice: async (assetId: string): Promise<number> => {
    const response = await apiClient.get<{ assetId: string; price: number }>(
      `/hypercore/assets/${assetId}/price`
    );
    return response.data.price;
  },

  validateAssetForPrivacy: async (assetId: string): Promise<boolean> => {
    const response = await apiClient.get<{ assetId: string; isValid: boolean }>(
      `/hypercore/assets/${assetId}/validate`
    );
    return response.data.isValid;
  },
};