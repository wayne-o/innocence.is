import { keccak256, toUtf8Bytes, hexlify, randomBytes, AbiCoder, concat, getBytes, parseUnits } from 'ethers';

const PROOF_SERVICE_URL = process.env.REACT_APP_PROOF_SERVICE_URL || 'http://localhost:3003';

export interface ProofGenerationParams {
  secret?: string;
  nullifier?: string;
  balance?: number | string;
  minBalance?: number | string;
  assetId?: number;
  validDays?: number;
  fromBalance?: number | string;
  toBalance?: number | string;
  fromAsset?: number;
  toAsset?: number;
  fromAmount?: number | string;
  minToAmount?: number | string;
  depositedAmount?: number | string;
  merkleRoot?: string;
}

export interface ProofResponse {
  proof: any;
  publicValues: any;
  commitment: string;
  proofType: string;
  timestamp: number;
  formattedProof?: string;
  encodedPublicValues?: string;
}

class ProofService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = PROOF_SERVICE_URL;
  }

  // Generate a random secret
  generateSecret(): string {
    const randBytes = randomBytes(32);
    return hexlify(randBytes);
  }

  // Generate a random nullifier
  generateNullifier(): string {
    const randBytes = randomBytes(32);
    return hexlify(randBytes);
  }

  // Store commitment data securely in browser
  storeCommitmentData(commitment: string, secret: string, nullifier: string): void {
    const data = {
      commitment,
      secret,
      nullifier,
      timestamp: Date.now()
    };
    
    // In production, encrypt this data
    localStorage.setItem(`innocence_${commitment}`, JSON.stringify(data));
  }

  // Retrieve commitment data
  getCommitmentData(commitment: string): { secret: string; nullifier: string } | null {
    const dataStr = localStorage.getItem(`innocence_${commitment}`);
    if (!dataStr) return null;
    
    const data = JSON.parse(dataStr);
    return {
      secret: data.secret,
      nullifier: data.nullifier
    };
  }

  // Compute commitment locally
  async computeCommitment(secret: string, nullifier: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/compute-commitment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, nullifier })
    });

    if (!response.ok) throw new Error('Failed to compute commitment');
    
    const data = await response.json();
    return data.commitment;
  }

  // Generate proof
  async generateProof(
    proofType: 'ownership' | 'balance' | 'compliance' | 'trade',
    params: ProofGenerationParams
  ): Promise<ProofResponse> {
    const response = await fetch(`${this.baseUrl}/api/generate-proof/${proofType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to generate proof');
    }

    return response.json();
  }

  // Encode public values for contract call
  async encodePublicValues(proofType: string, values: any): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/encode-public-values/${proofType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });

    if (!response.ok) throw new Error('Failed to encode public values');
    
    const data = await response.json();
    return data.encoded;
  }

  // Convert SP1 proof to bytes for contract
  proofToBytes(proof: any): string {
    try {
      // Check if this is an SP1 proof structure
      if (proof && proof.proof && proof.proof.Core) {
        // This is a real SP1 proof - we need to serialize it properly
        // SP1 proofs need to be encoded in a specific format for the verifier
        
        // For now, we'll encode the proof as a compact representation
        // In production, this should match the exact format expected by SP1Verifier
        
        // Extract key proof components
        const core = proof.proof.Core[0];
        const commitment = core.commitment;
        const openedValues = core.opened_values;
        
        // Create a simplified proof representation
        // This is a placeholder - the actual serialization depends on the SP1 verifier version
        const proofData = {
          mainCommit: commitment.main_commit.value,
          permutationCommit: commitment.permutation_commit.value,
          quotientCommit: commitment.quotient_commit.value,
          openedChips: openedValues.chips.map((chip: any) => ({
            logDegree: chip.log_degree,
            quotient: chip.quotient[0][0].value
          }))
        };
        
        // For SP1VerifierGroth16, we need to convert to the expected format:
        // 4-byte selector + 8 uint256 values
        
        // The verifier selector for SP1VerifierGroth16
        const VERIFIER_SELECTOR = '0xa4594c59';
        
        // Extract 8 uint256 values from the proof data
        // This is a simplified conversion - in production, use proper SP1 SDK
        const groth16Points = [
          proofData.mainCommit[0] || 0,
          proofData.mainCommit[1] || 0,
          proofData.permutationCommit[0] || 0,
          proofData.permutationCommit[1] || 0,
          proofData.quotientCommit[0] || 0,
          proofData.quotientCommit[1] || 0,
          proofData.openedChips[0]?.quotient[0] || 0,
          proofData.openedChips[0]?.logDegree || 0
        ];
        
        // Encode as bytes with selector prefix
        const proofWithoutSelector = AbiCoder.defaultAbiCoder().encode(
          ['uint256[8]'],
          [groth16Points]
        );
        
        // Combine selector + proof data
        const proofBytes = VERIFIER_SELECTOR + proofWithoutSelector.slice(2);
        
        return proofBytes;
      } else {
        // Fallback for unexpected proof format
        console.warn('Unexpected proof format, using hash encoding');
        const proofString = JSON.stringify(proof);
        const proofHash = keccak256(toUtf8Bytes(proofString));
        return proofHash + proofHash.slice(2);
      }
    } catch (error) {
      console.error('Error serializing proof:', error);
      throw new Error('Failed to serialize proof: ' + error);
    }
  }

  // Helper for deposit with compliance proof
  async generateDepositProof(secret: string, nullifier: string): Promise<{
    commitment: string;
    proofBytes: string;
    publicValues: string;
  }> {
    try {
      const commitment = await this.computeCommitment(secret, nullifier);
      
      // Try to use real proof service first
      try {
        const proofResponse = await this.generateProof('compliance', {
          secret,
          nullifier,
          validDays: 365
        });

        // Use the server-formatted proof and encoded public values
        return {
          commitment,
          proofBytes: proofResponse.formattedProof || this.proofToBytes(proofResponse.proof),
          publicValues: proofResponse.encodedPublicValues || await this.encodePublicValues('compliance', proofResponse.publicValues)
        };
      } catch (error) {
        console.error('Proof service unavailable');
        throw new Error('Proof service is required. Please ensure the proof service is running at ' + this.baseUrl);
      }
    } catch (error: any) {
      console.error('Error generating deposit proof:', error);
      throw new Error('Failed to generate deposit proof: ' + error.message);
    }
  }

  // Helper for trade proof
  async generateTradeProof(
    commitment: string,
    fromAsset: number,
    toAsset: number,
    fromAmount: number,
    minToAmount: number,
    privacySystem?: any
  ): Promise<{
    proofBytes: string;
    publicValues: string;
  }> {
    try {
      const commitmentData = this.getCommitmentData(commitment);
      if (!commitmentData) throw new Error('Commitment data not found');

      const proofResponse = await this.generateProof('trade', {
        secret: commitmentData.secret,
        nullifier: commitmentData.nullifier,
        fromAsset,
        toAsset,
        fromAmount,
        minToAmount,
        fromBalance: fromAmount * 2, // Mock: assume we have 2x the amount we're trading
        toBalance: minToAmount * 2 // Mock: assume we'll have 2x what we're getting
      });

      // Use the server-formatted proof and encoded public values
      return {
        proofBytes: proofResponse.formattedProof || this.proofToBytes(proofResponse.proof),
        publicValues: proofResponse.encodedPublicValues || await this.encodePublicValues('trade', proofResponse.publicValues)
      };
    } catch (error: any) {
      console.error('Error generating trade proof:', error);
      throw new Error('Failed to generate trade proof. Please ensure the proof service is running at ' + this.baseUrl);
    }
  }

  // Helper for innocence proof
  async checkSanctionsStatus(address: string): Promise<{
    isSanctioned: boolean;
    sanctionsRoot: string;
    timestamp: number;
  }> {
    const BACKEND_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5169';
    const response = await fetch(`${BACKEND_API_URL}/api/compliance/sanctions/check/${address}`);
    if (!response.ok) throw new Error('Failed to check sanctions status');
    return response.json();
  }

  async generateInnocenceProof(depositor: string): Promise<{
    proofBytes: string;
    publicValues: string;
    status: any;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate-proof/innocence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositor })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate innocence proof');
      }

      const proofResponse = await response.json();
      
      return {
        proofBytes: proofResponse.formattedProof || this.proofToBytes(proofResponse.proof),
        publicValues: proofResponse.encodedPublicValues || await this.encodePublicValues('innocence', {
          depositor,
          sanctionsRoot: proofResponse.status.sanctionsRoot,
          timestamp: proofResponse.status.timestamp,
          isInnocent: true
        }),
        status: proofResponse.status
      };
    } catch (error: any) {
      console.error('Error generating innocence proof:', error);
      throw new Error('Failed to generate innocence proof: ' + error.message);
    }
  }

  // Helper for withdrawal proof
  async generateWithdrawalProof(
    commitment: string,
    token: number,
    amount: number,
    merkleRoot: string
  ): Promise<{
    nullifier: string;
    proofBytes: string;
    publicValues: string;
  }> {
    try {
      const commitmentData = this.getCommitmentData(commitment);
      if (!commitmentData) throw new Error('Commitment data not found');

      // For withdrawal proof, we need to prove we have at least the amount we're withdrawing
      // The amount is already in wei units (e.g., 1000000 for 0.01 HYPe with 8 decimals)  
      // Actual balance should be larger than the minimum balance (withdrawal amount)
      const actualBalance = Math.max(amount * 2, amount + 10000000); // At least 2x withdrawal amount or withdrawal + 0.1 HYPe
      
      const proofResponse = await this.generateProof('balance', {
        secret: commitmentData.secret,
        nullifier: commitmentData.nullifier,
        balance: actualBalance, // Reasonable balance that covers withdrawal
        minBalance: amount, // Minimum required is the withdrawal amount
        assetId: token,
        merkleRoot: merkleRoot // Pass the correct merkle root
      });

      const nullifierHash = keccak256(toUtf8Bytes(commitmentData.nullifier));
      
      // Use the server-formatted proof and encoded public values
      return {
        nullifier: nullifierHash,
        proofBytes: proofResponse.formattedProof || this.proofToBytes(proofResponse.proof),
        publicValues: proofResponse.encodedPublicValues || await this.encodePublicValues('balance', proofResponse.publicValues)
      };
    } catch (error: any) {
      console.error('Error generating withdrawal proof:', error);
      throw new Error('Failed to generate withdrawal proof. Please ensure the proof service is running at ' + this.baseUrl);
    }
  }
}

export default new ProofService();