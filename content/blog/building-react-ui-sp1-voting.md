---
title: "Building a React UI for Zero-Knowledge Voting with SP1"
date: 2025-06-07T00:00:00Z
draft: false
tags: ["SP1", "React", "Web3", "Zero-Knowledge", "Tutorial"]
---

In our [previous tutorial](/blog/building-a-decentralized-voting-system-with-sp1-zkvm/), we built a zero-knowledge voting system using SP1 zkVM. Now, let's create a user-friendly React interface that makes it easy for voters to participate while maintaining complete privacy.

## What We're Building

We'll create a React application that:
- Connects to users' Web3 wallets
- Generates zero-knowledge proofs in the browser
- Submits votes to the smart contract
- Displays real-time voting results
- Maintains complete voter privacy

## Prerequisites

```bash
# Node.js and npm
node --version  # Should be 16+
npm --version

# Create React App
npx create-react-app zk-voting-ui --template typescript
cd zk-voting-ui
```

## Project Structure

```
zk-voting-ui/
├── src/
│   ├── components/
│   │   ├── WalletConnect.tsx
│   │   ├── VotingForm.tsx
│   │   ├── ResultsDisplay.tsx
│   │   └── ProofStatus.tsx
│   ├── hooks/
│   │   ├── useWallet.ts
│   │   └── useVoting.ts
│   ├── services/
│   │   ├── proofService.ts
│   │   └── contractService.ts
│   └── App.tsx
```

## Step 1: Install Dependencies

```bash
npm install ethers@5 @sp1-sdk/browser axios
npm install -D @types/react @types/node
```

## Step 2: Wallet Connection Component

Create `src/components/WalletConnect.tsx`:

```typescript
import React from 'react';
import { useWallet } from '../hooks/useWallet';

export const WalletConnect: React.FC = () => {
  const { account, connecting, connect, disconnect } = useWallet();

  return (
    <div className="wallet-connect">
      {!account ? (
        <button onClick={connect} disabled={connecting}>
          {connecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="wallet-info">
          <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      )}
    </div>
  );
};
```

## Step 3: Wallet Hook

Create `src/hooks/useWallet.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

interface WalletState {
  account: string | null;
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  connecting: boolean;
}

export const useWallet = () => {
  const [state, setState] = useState<WalletState>({
    account: null,
    provider: null,
    signer: null,
    connecting: false,
  });

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }

    setState(prev => ({ ...prev, connecting: true }));

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      
      setState({
        account: accounts[0],
        provider,
        signer,
        connecting: false,
      });
    } catch (error) {
      console.error('Failed to connect:', error);
      setState(prev => ({ ...prev, connecting: false }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      account: null,
      provider: null,
      signer: null,
      connecting: false,
    });
  }, []);

  // Auto-connect if previously connected
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            connect();
          }
        });
    }
  }, [connect]);

  return {
    ...state,
    connect,
    disconnect,
  };
};
```

## Step 4: Voting Form Component

Create `src/components/VotingForm.tsx`:

```typescript
import React, { useState } from 'react';
import { useVoting } from '../hooks/useVoting';

const CANDIDATES = [
  { id: 1, name: 'Alice Johnson', party: 'Progressive' },
  { id: 2, name: 'Bob Smith', party: 'Conservative' },
  { id: 3, name: 'Carol Williams', party: 'Independent' },
];

export const VotingForm: React.FC = () => {
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const { submitVote, submitting, error, success } = useVoting();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCandidate === null) {
      alert('Please select a candidate');
      return;
    }
    
    await submitVote(selectedCandidate);
  };

  if (success) {
    return (
      <div className="success-message">
        <h3>✅ Vote Submitted Successfully!</h3>
        <p>Your vote has been recorded anonymously.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="voting-form">
      <h2>Cast Your Vote</h2>
      
      <div className="candidates">
        {CANDIDATES.map(candidate => (
          <label key={candidate.id} className="candidate-option">
            <input
              type="radio"
              name="candidate"
              value={candidate.id}
              checked={selectedCandidate === candidate.id}
              onChange={() => setSelectedCandidate(candidate.id)}
              disabled={submitting}
            />
            <div className="candidate-info">
              <strong>{candidate.name}</strong>
              <span>{candidate.party}</span>
            </div>
          </label>
        ))}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <button 
        type="submit" 
        disabled={submitting || selectedCandidate === null}
      >
        {submitting ? 'Generating Proof...' : 'Submit Vote'}
      </button>
    </form>
  );
};
```

## Step 5: Proof Generation Service

Create `src/services/proofService.ts`:

```typescript
import axios from 'axios';

interface VoteInput {
  voterSecret: string;
  voterNullifier: string;
  candidateId: number;
  merkleProof: string[];
  merkleRoot: string;
}

interface ProofResponse {
  proof: string;
  publicValues: string;
  nullifier: string;
}

export class ProofService {
  private apiUrl: string;

  constructor(apiUrl = process.env.REACT_APP_PROOF_API_URL || 'http://localhost:8080') {
    this.apiUrl = apiUrl;
  }

  async generateVoterCredentials(address: string): Promise<{
    secret: string;
    nullifier: string;
  }> {
    // In production, this would use proper key derivation
    const encoder = new TextEncoder();
    const data = encoder.encode(address + Date.now());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return {
      secret: hashHex,
      nullifier: hashHex.split('').reverse().join(''),
    };
  }

  async generateProof(
    candidateId: number,
    voterAddress: string
  ): Promise<ProofResponse> {
    try {
      const { secret, nullifier } = await this.generateVoterCredentials(voterAddress);
      
      // In production, fetch real merkle proof from server
      const voteInput: VoteInput = {
        voterSecret: secret,
        voterNullifier: nullifier,
        candidateId,
        merkleProof: [], // Empty for demo (voter is root)
        merkleRoot: await this.computeMerkleRoot(secret, nullifier),
      };

      // Call proof generation API
      const response = await axios.post(`${this.apiUrl}/generate-proof`, voteInput);
      
      return response.data;
    } catch (error) {
      console.error('Proof generation failed:', error);
      throw new Error('Failed to generate zero-knowledge proof');
    }
  }

  private async computeMerkleRoot(secret: string, nullifier: string): Promise<string> {
    // This should match the circuit's hash_voter function
    const encoder = new TextEncoder();
    const data = encoder.encode(secret + nullifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
```

## Step 6: Smart Contract Service

Create `src/services/contractService.ts`:

```typescript
import { ethers } from 'ethers';
import { VOTING_CONTRACT_ABI, VOTING_CONTRACT_ADDRESS } from '../constants';

export class ContractService {
  private contract: ethers.Contract;

  constructor(signer: ethers.Signer) {
    this.contract = new ethers.Contract(
      VOTING_CONTRACT_ADDRESS,
      VOTING_CONTRACT_ABI,
      signer
    );
  }

  async hasVoted(nullifier: string): Promise<boolean> {
    return await this.contract.nullifierUsed(nullifier);
  }

  async submitVote(
    proof: string,
    publicValues: string
  ): Promise<ethers.ContractTransaction> {
    return await this.contract.castVote(proof, publicValues);
  }

  async getVoteCount(candidateId: number): Promise<number> {
    const count = await this.contract.getVoteCount(candidateId);
    return count.toNumber();
  }

  async getTotalVotes(): Promise<number> {
    // Sum votes for all candidates
    let total = 0;
    for (let i = 1; i <= 3; i++) {
      const count = await this.contract.getVoteCount(i);
      total += count.toNumber();
    }
    return total;
  }
}
```

## Step 7: Voting Hook

Create `src/hooks/useVoting.ts`:

```typescript
import { useState, useCallback } from 'react';
import { useWallet } from './useWallet';
import { ProofService } from '../services/proofService';
import { ContractService } from '../services/contractService';

export const useVoting = () => {
  const { account, signer } = useWallet();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submitVote = useCallback(async (candidateId: number) => {
    if (!account || !signer) {
      setError('Please connect your wallet');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Generate proof
      const proofService = new ProofService();
      const { proof, publicValues, nullifier } = await proofService.generateProof(
        candidateId,
        account
      );

      // Check if already voted
      const contractService = new ContractService(signer);
      const hasVoted = await contractService.hasVoted(nullifier);
      
      if (hasVoted) {
        throw new Error('You have already voted');
      }

      // Submit vote
      const tx = await contractService.submitVote(proof, publicValues);
      await tx.wait();

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit vote');
    } finally {
      setSubmitting(false);
    }
  }, [account, signer]);

  return {
    submitVote,
    submitting,
    error,
    success,
  };
};
```

## Step 8: Results Display

Create `src/components/ResultsDisplay.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { ContractService } from '../services/contractService';

interface VoteResults {
  candidate1: number;
  candidate2: number;
  candidate3: number;
  total: number;
}

export const ResultsDisplay: React.FC = () => {
  const { signer } = useWallet();
  const [results, setResults] = useState<VoteResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!signer) return;

    const fetchResults = async () => {
      setLoading(true);
      try {
        const contractService = new ContractService(signer);
        const [candidate1, candidate2, candidate3, total] = await Promise.all([
          contractService.getVoteCount(1),
          contractService.getVoteCount(2),
          contractService.getVoteCount(3),
          contractService.getTotalVotes(),
        ]);

        setResults({ candidate1, candidate2, candidate3, total });
      } catch (error) {
        console.error('Failed to fetch results:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
    const interval = setInterval(fetchResults, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, [signer]);

  if (loading && !results) {
    return <div>Loading results...</div>;
  }

  if (!results) {
    return null;
  }

  const getPercentage = (votes: number) => {
    return results.total > 0 ? ((votes / results.total) * 100).toFixed(1) : '0';
  };

  return (
    <div className="results-display">
      <h2>Current Results</h2>
      <p className="total-votes">Total Votes: {results.total}</p>
      
      <div className="results-bars">
        <div className="result-item">
          <div className="candidate-name">Alice Johnson</div>
          <div className="result-bar">
            <div 
              className="result-fill"
              style={{ width: `${getPercentage(results.candidate1)}%` }}
            />
            <span className="result-text">
              {results.candidate1} votes ({getPercentage(results.candidate1)}%)
            </span>
          </div>
        </div>

        <div className="result-item">
          <div className="candidate-name">Bob Smith</div>
          <div className="result-bar">
            <div 
              className="result-fill"
              style={{ width: `${getPercentage(results.candidate2)}%` }}
            />
            <span className="result-text">
              {results.candidate2} votes ({getPercentage(results.candidate2)}%)
            </span>
          </div>
        </div>

        <div className="result-item">
          <div className="candidate-name">Carol Williams</div>
          <div className="result-bar">
            <div 
              className="result-fill"
              style={{ width: `${getPercentage(results.candidate3)}%` }}
            />
            <span className="result-text">
              {results.candidate3} votes ({getPercentage(results.candidate3)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

## Step 9: Main App Component

Update `src/App.tsx`:

```typescript
import React from 'react';
import './App.css';
import { WalletConnect } from './components/WalletConnect';
import { VotingForm } from './components/VotingForm';
import { ResultsDisplay } from './components/ResultsDisplay';
import { useWallet } from './hooks/useWallet';

function App() {
  const { account } = useWallet();

  return (
    <div className="App">
      <header className="App-header">
        <h1>🗳️ Zero-Knowledge Voting</h1>
        <p>Vote privately with SP1 zkVM</p>
      </header>

      <main className="App-main">
        <WalletConnect />
        
        {account && (
          <>
            <VotingForm />
            <ResultsDisplay />
          </>
        )}

        <div className="privacy-notice">
          <h3>🔒 Your Privacy is Protected</h3>
          <p>
            This voting system uses zero-knowledge proofs to ensure your vote 
            remains completely private while still being verifiable.
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
```

## Step 10: Styling

Add to `src/App.css`:

```css
.App {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.App-header {
  padding: 2rem;
  text-align: center;
}

.App-main {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.wallet-connect {
  background: rgba(255, 255, 255, 0.1);
  padding: 1.5rem;
  border-radius: 10px;
  margin-bottom: 2rem;
  text-align: center;
}

.wallet-connect button {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 5px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s;
}

.wallet-connect button:hover {
  background: #45a049;
}

.voting-form {
  background: rgba(255, 255, 255, 0.1);
  padding: 2rem;
  border-radius: 10px;
  margin-bottom: 2rem;
}

.candidates {
  margin: 1.5rem 0;
}

.candidate-option {
  display: flex;
  align-items: center;
  padding: 1rem;
  margin: 0.5rem 0;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.3s;
}

.candidate-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.candidate-info {
  margin-left: 1rem;
  display: flex;
  flex-direction: column;
}

.candidate-info strong {
  font-size: 1.1rem;
}

.candidate-info span {
  font-size: 0.9rem;
  opacity: 0.8;
}

.results-display {
  background: rgba(255, 255, 255, 0.1);
  padding: 2rem;
  border-radius: 10px;
  margin-bottom: 2rem;
}

.result-bar {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 5px;
  height: 40px;
  position: relative;
  margin: 0.5rem 0;
  overflow: hidden;
}

.result-fill {
  background: #4CAF50;
  height: 100%;
  transition: width 0.5s ease;
}

.result-text {
  position: absolute;
  top: 50%;
  left: 10px;
  transform: translateY(-50%);
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}

.error-message {
  background: #f44336;
  color: white;
  padding: 1rem;
  border-radius: 5px;
  margin: 1rem 0;
}

.success-message {
  background: #4CAF50;
  color: white;
  padding: 2rem;
  border-radius: 10px;
  text-align: center;
}

.privacy-notice {
  background: rgba(255, 255, 255, 0.1);
  padding: 1.5rem;
  border-radius: 10px;
  text-align: center;
}
```

## Running the Application

1. **Start the proof generation server** (from our previous tutorial):
```bash
cd zk-voting/script
cargo run --bin proof-server
```

2. **Deploy the smart contract** (if not already deployed):
```bash
cd contracts
npx hardhat run scripts/deploy.js --network yourNetwork
```

3. **Start the React app**:
```bash
cd zk-voting-ui
npm start
```

## Security Considerations

- **Private key management**: Never expose private keys in the frontend
- **Proof generation**: In production, use secure enclaves or TEEs
- **API security**: Implement rate limiting and authentication
- **Contract upgrades**: Consider proxy patterns for upgradability

## Next Steps

- Add support for multiple elections
- Implement voter registration process
- Add admin dashboard for election management
- Support for ranked choice voting
- Mobile app development

## Conclusion

We've built a complete privacy-preserving voting application using SP1 zkVM and React. Users can cast votes that are completely anonymous yet fully verifiable - demonstrating the power of zero-knowledge proofs in creating trustless democratic systems.

The combination of SP1's accessible Rust development, React's familiar interface patterns, and Ethereum's decentralized infrastructure makes building privacy-first applications more accessible than ever.

---

*Ready to build? Check out the [complete code on GitHub](https://github.com/wayne-o/zk-voting-sp1) and our [previous tutorial](/blog/building-a-decentralized-voting-system-with-sp1-zkvm/) on building the zkVM circuits.*