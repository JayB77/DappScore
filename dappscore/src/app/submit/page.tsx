'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage, useChainId } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  Check, ChevronLeft, ChevronRight, Wallet, Upload, AlertCircle,
  Plus, Trash2, Crown, AlertTriangle, Shield, ExternalLink, Loader2,
  SkipForward, Clock
} from 'lucide-react';
import { useUSDCPayment } from '@/hooks/useUSDCPayment';
import { baseSepolia } from 'wagmi/chains';

const steps = [
  { id: 1, name: 'General', description: 'Basic project info' },
  { id: 2, name: 'Details', description: 'Token & sale details' },
  { id: 3, name: 'Links', description: 'Social & resources' },
  { id: 4, name: 'Team', description: 'Team information' },
  { id: 5, name: 'Payment', description: 'Listing option' },
];

const categories = [
  'DeFi', 'Gaming', 'AI', 'NFT', 'Social', 'Infrastructure',
  'DAO', 'Metaverse', 'Privacy', 'Storage', 'Identity',
  'Oracle', 'Bridge', 'DEX', 'Lending', 'Yield', 'Other'
];

const blockchains = [
  'Base', 'Ethereum', 'Arbitrum', 'Optimism', 'Polygon',
  'BNB Chain', 'Avalanche', 'Solana', 'Fantom', 'zkSync',
  'Linea', 'Scroll', 'Other'
];

const saleTypes = [
  { value: 'ico', label: 'ICO (Initial Coin Offering)' },
  { value: 'ieo', label: 'IEO (Initial Exchange Offering)' },
  { value: 'ido', label: 'IDO (Initial DEX Offering)' },
  { value: 'fair_launch', label: 'Fair Launch' },
  { value: 'presale', label: 'Presale' },
];

const projectStages = [
  { value: 'concept', label: 'Concept / Idea' },
  { value: 'development', label: 'In Development' },
  { value: 'testnet', label: 'Testnet Live' },
  { value: 'mainnet_beta', label: 'Mainnet Beta' },
  { value: 'mainnet', label: 'Mainnet Live' },
  { value: 'launched', label: 'Fully Launched' },
  { value: 'discontinued', label: 'Discontinued' },
];

interface ContractAddress {
  chain: string;
  address: string;
}

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  photoUrl: string;
  linkedin: string;
  twitter: string;
}

// Mock existing projects for duplicate detection
const existingProjects = [
  { name: 'DeFi Protocol X', symbol: 'DPX', contracts: ['0x1234...'] },
  { name: 'GameFi World', symbol: 'GFW', contracts: ['0x5678...'] },
];

export default function SubmitProjectPage() {
  const { isConnected, address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const chainId = useChainId();
  const [currentStep, setCurrentStep] = useState(1);
  const [isOwnProject, setIsOwnProject] = useState(false);
  const [hasTokenSale, setHasTokenSale] = useState(false);
  const [ownershipVerified, setOwnershipVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // USDC Payment hook
  const {
    status: paymentStatus,
    error: paymentError,
    txHash,
    formattedBalance,
    formattedPrice,
    isConfirming,
    isConfirmed,
    checkBalance,
    payForPremium,
    reset: resetPayment,
  } = useUSDCPayment();

  const isTestnet = chainId === baseSepolia.id;

  const [formData, setFormData] = useState({
    // General (only name, symbol, category, description are required)
    submitterName: '',
    submitterEmail: '',
    projectName: '',
    tokenSymbol: '',
    category: '',
    description: '',

    // Details (all optional)
    blockchain: '',
    projectStage: '',
    saleType: '',
    tokenName: '',
    totalSupply: '',
    hardCap: '',
    softCap: '',
    tokenPrice: '',
    startDate: '',
    endDate: '',
    projectImageUrl: '',
    tokenImageUrl: '',

    // Links (discord or telegram required; others optional)
    website: '',
    whitepaper: '',
    pitchDeck: '',
    twitter: '',
    telegram: '',
    discord: '',
    reddit: '',
    medium: '',
    youtube: '',
    github: '',
    facebook: '',
    linkedin: '',
    tiktok: '',
    instagram: '',

    // Payment
    listingType: 'free',
    paymentMethod: 'eth',
  });

  const [contractAddresses, setContractAddresses] = useState<ContractAddress[]>([
    { chain: '', address: '' }
  ]);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { name: '', role: '', bio: '', photoUrl: '', linkedin: '', twitter: '' }
  ]);

  // Mark as submitted when payment is confirmed
  useEffect(() => {
    if (isConfirmed && formData.listingType === 'premium' && !submitted) {
      setSubmitted(true);
    }
  }, [isConfirmed, formData.listingType, submitted]);

  // Duplicate detection
  useEffect(() => {
    if (formData.projectName || formData.tokenSymbol || contractAddresses.some(c => c.address)) {
      const nameMatch = existingProjects.find(p =>
        p.name.toLowerCase() === formData.projectName.toLowerCase()
      );
      const symbolMatch = existingProjects.find(p =>
        p.symbol.toLowerCase() === formData.tokenSymbol.toLowerCase()
      );
      const contractMatch = existingProjects.find(p =>
        contractAddresses.some(c => p.contracts.includes(c.address))
      );

      if (nameMatch) {
        setDuplicateWarning(`A project named "${nameMatch.name}" already exists`);
      } else if (contractMatch) {
        setDuplicateWarning(`A project with this contract address already exists`);
      } else {
        setDuplicateWarning(null);
      }
    }
  }, [formData.projectName, formData.tokenSymbol, contractAddresses]);

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addContractAddress = () => {
    setContractAddresses((prev) => [...prev, { chain: '', address: '' }]);
  };

  const removeContractAddress = (index: number) => {
    if (contractAddresses.length > 1) {
      setContractAddresses((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updateContractAddress = (index: number, field: keyof ContractAddress, value: string) => {
    setContractAddresses((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addTeamMember = () => {
    setTeamMembers((prev) => [...prev, { name: '', role: '', bio: '', photoUrl: '', linkedin: '', twitter: '' }]);
  };

  const removeTeamMember = (index: number) => {
    if (teamMembers.length > 1) {
      setTeamMembers((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
    setTeamMembers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const verifyOwnership = async () => {
    if (!address) return;
    setVerifying(true);
    try {
      const message = `I verify ownership of ${formData.projectName} (${formData.tokenSymbol}) on DappScore.\n\nWallet: ${address}\nTimestamp: ${Date.now()}`;
      const signature = await signMessageAsync({ message });
      if (signature) {
        setOwnershipVerified(true);
      }
    } catch (error) {
      console.error('Signature failed:', error);
    }
    setVerifying(false);
  };

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 5));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const isStepValid = () => {
    if (currentStep === 1) {
      return formData.projectName && formData.tokenSymbol && formData.category && formData.description;
    }
    if (currentStep === 3) {
      return !!(formData.telegram || formData.discord);
    }
    return true;
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Wallet className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-6">You need to connect your wallet to submit a project</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-center mb-2">Submit Your Project</h1>
        <p className="text-gray-400 text-center mb-4">
          Get your project listed on DappScore and let the community evaluate it
        </p>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      currentStep > step.id
                        ? 'bg-green-500 text-white'
                        : currentStep === step.id
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
                  </div>
                  <span className="text-xs mt-1 text-gray-400 hidden sm:block">{step.name}</span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-12 sm:w-20 h-1 mx-2 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Duplicate Warning */}
        {duplicateWarning && (
          <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/50 rounded-lg flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-400">Possible Duplicate</p>
              <p className="text-sm text-gray-400">{duplicateWarning}. You can still submit if this is a different project.</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bg-gray-800 rounded-xl p-6">
          {/* Step 1: General Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">General Information</h2>
              <p className="text-gray-400 text-sm">Fields marked with * are required</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Your Name</label>
                  <input
                    type="text"
                    value={formData.submitterName}
                    onChange={(e) => updateFormData('submitterName', e.target.value)}
                    placeholder="Your name (optional)"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Your Email</label>
                  <input
                    type="email"
                    value={formData.submitterEmail}
                    onChange={(e) => updateFormData('submitterEmail', e.target.value)}
                    placeholder="your@email.com (optional)"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Project Name *</label>
                <input
                  type="text"
                  value={formData.projectName}
                  onChange={(e) => updateFormData('projectName', e.target.value)}
                  placeholder="e.g., DeFi Protocol X"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Token Symbol *</label>
                  <input
                    type="text"
                    value={formData.tokenSymbol}
                    onChange={(e) => updateFormData('tokenSymbol', e.target.value.toUpperCase())}
                    placeholder="e.g., DPX"
                    maxLength={10}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => updateFormData('category', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  placeholder="Describe your project in detail. What problem does it solve? What makes it unique?"
                  rows={5}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">{formData.description.length}/2000 characters</p>
              </div>

              {/* Ownership Claim */}
              <div className="p-4 bg-gray-700/50 rounded-lg space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="isOwnProject"
                    checked={isOwnProject}
                    onChange={(e) => setIsOwnProject(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                  />
                  <label htmlFor="isOwnProject" className="text-sm">
                    I am a team member of this project and want to claim ownership
                  </label>
                </div>

                {isOwnProject && (
                  <div className="pl-8 space-y-3">
                    <p className="text-xs text-gray-400">
                      Verify ownership by signing a message with your wallet. This proves you control the wallet associated with this project.
                    </p>
                    {ownershipVerified ? (
                      <div className="flex items-center space-x-2 text-green-400">
                        <Shield className="h-5 w-5" />
                        <span className="text-sm font-medium">Ownership Verified</span>
                      </div>
                    ) : (
                      <button
                        onClick={verifyOwnership}
                        disabled={verifying || !formData.projectName}
                        className="px-4 py-2 bg-yellow-500 text-black font-medium rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {verifying ? 'Signing...' : 'Sign Message to Verify'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Project Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Project Details</h2>
              <p className="text-gray-400 text-sm">All fields are optional - fill out what you know</p>

              {/* Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Project Logo</label>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      value={formData.projectImageUrl}
                      onChange={(e) => updateFormData('projectImageUrl', e.target.value)}
                      placeholder="https://yourproject.com/logo.png"
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                    />
                    <button type="button" className="px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg hover:border-yellow-500 transition-colors">
                      <Upload className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">200x200px, PNG or JPG</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Token Icon</label>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      value={formData.tokenImageUrl}
                      onChange={(e) => updateFormData('tokenImageUrl', e.target.value)}
                      placeholder="https://yourproject.com/token.png"
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                    />
                    <button type="button" className="px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg hover:border-yellow-500 transition-colors">
                      <Upload className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">100x100px, PNG with transparency</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Primary Blockchain</label>
                  <select
                    value={formData.blockchain}
                    onChange={(e) => updateFormData('blockchain', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="">Select blockchain</option>
                    {blockchains.map((chain) => (
                      <option key={chain} value={chain}>{chain}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Project Stage</label>
                  <select
                    value={formData.projectStage}
                    onChange={(e) => updateFormData('projectStage', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="">Select stage</option>
                    {projectStages.map((stage) => (
                      <option key={stage.value} value={stage.value}>{stage.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Contract Addresses */}
              <div className="space-y-3">
                <label className="block text-sm text-gray-400">Contract Addresses</label>
                {contractAddresses.map((contract, index) => (
                  <div key={index} className="flex space-x-2">
                    <select
                      value={contract.chain}
                      onChange={(e) => updateContractAddress(index, 'chain', e.target.value)}
                      className="w-40 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:border-yellow-500 focus:outline-none text-sm"
                    >
                      <option value="">Chain</option>
                      {blockchains.map((chain) => (
                        <option key={chain} value={chain}>{chain}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={contract.address}
                      onChange={(e) => updateContractAddress(index, 'address', e.target.value)}
                      placeholder="0x..."
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-yellow-500 focus:outline-none font-mono text-sm"
                    />
                    {contractAddresses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContractAddress(index)}
                        className="p-2 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addContractAddress}
                  className="text-yellow-500 hover:text-yellow-400 text-sm flex items-center space-x-1"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Another Contract</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Token Name (if different from project)</label>
                  <input
                    type="text"
                    value={formData.tokenName}
                    onChange={(e) => updateFormData('tokenName', e.target.value)}
                    placeholder="e.g., Protocol X Token"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Total Supply</label>
                  <input
                    type="text"
                    value={formData.totalSupply}
                    onChange={(e) => updateFormData('totalSupply', e.target.value)}
                    placeholder="e.g., 100,000,000"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Token Sale Section */}
              <div className="pt-4 border-t border-gray-700">
                <div className="flex items-center space-x-3 mb-4">
                  <input
                    type="checkbox"
                    id="hasTokenSale"
                    checked={hasTokenSale}
                    onChange={(e) => setHasTokenSale(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                  />
                  <label htmlFor="hasTokenSale" className="text-sm font-medium">
                    This project has an active or upcoming token sale
                  </label>
                </div>

                {hasTokenSale && (
                  <div className="space-y-4 pl-8 border-l-2 border-yellow-500/30">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Sale Type</label>
                      <select
                        value={formData.saleType}
                        onChange={(e) => updateFormData('saleType', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                      >
                        <option value="">Select sale type</option>
                        {saleTypes.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Hard Cap (USD)</label>
                        <input
                          type="text"
                          value={formData.hardCap}
                          onChange={(e) => updateFormData('hardCap', e.target.value)}
                          placeholder="e.g., 2,000,000"
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Soft Cap (USD)</label>
                        <input
                          type="text"
                          value={formData.softCap}
                          onChange={(e) => updateFormData('softCap', e.target.value)}
                          placeholder="e.g., 500,000"
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Token Price (USD)</label>
                        <input
                          type="text"
                          value={formData.tokenPrice}
                          onChange={(e) => updateFormData('tokenPrice', e.target.value)}
                          placeholder="e.g., 0.05"
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Sale Start Date</label>
                        <input
                          type="datetime-local"
                          value={formData.startDate}
                          onChange={(e) => updateFormData('startDate', e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Sale End Date</label>
                        <input
                          type="datetime-local"
                          value={formData.endDate}
                          onChange={(e) => updateFormData('endDate', e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Links & Resources */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Links & Resources</h2>
              <p className="text-gray-400 text-sm">At least one community link (Discord or Telegram) is required. All other fields are optional.</p>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => updateFormData('website', e.target.value)}
                  placeholder="https://yourproject.com"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Whitepaper</label>
                  <input
                    type="url"
                    value={formData.whitepaper}
                    onChange={(e) => updateFormData('whitepaper', e.target.value)}
                    placeholder="https://yourproject.com/whitepaper.pdf"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Pitch Deck</label>
                  <input
                    type="url"
                    value={formData.pitchDeck}
                    onChange={(e) => updateFormData('pitchDeck', e.target.value)}
                    placeholder="https://yourproject.com/pitch.pdf"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              <h3 className="text-lg font-semibold pt-4 border-t border-gray-700">Community Links <span className="text-red-400 text-sm font-normal">(at least one required)</span></h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Discord <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="url"
                    value={formData.discord}
                    onChange={(e) => updateFormData('discord', e.target.value)}
                    placeholder="https://discord.gg/yourproject"
                    className={`w-full bg-gray-700 border rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none ${
                      !formData.discord && !formData.telegram ? 'border-red-500/50' : 'border-gray-600'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Telegram <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="url"
                    value={formData.telegram}
                    onChange={(e) => updateFormData('telegram', e.target.value)}
                    placeholder="https://t.me/yourproject"
                    className={`w-full bg-gray-700 border rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none ${
                      !formData.discord && !formData.telegram ? 'border-red-500/50' : 'border-gray-600'
                    }`}
                  />
                </div>
              </div>

              {!formData.discord && !formData.telegram && (
                <p className="text-red-400 text-sm">Please provide at least a Discord or Telegram link to continue.</p>
              )}

              <h3 className="text-lg font-semibold pt-4 border-t border-gray-700">Other Social Media <span className="text-gray-500 text-sm font-normal">(optional)</span></h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Twitter / X</label>
                  <input
                    type="url"
                    value={formData.twitter}
                    onChange={(e) => updateFormData('twitter', e.target.value)}
                    placeholder="https://twitter.com/yourproject"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">LinkedIn</label>
                  <input
                    type="url"
                    value={formData.linkedin}
                    onChange={(e) => updateFormData('linkedin', e.target.value)}
                    placeholder="https://linkedin.com/company/yourproject"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Reddit</label>
                  <input
                    type="url"
                    value={formData.reddit}
                    onChange={(e) => updateFormData('reddit', e.target.value)}
                    placeholder="https://reddit.com/r/yourproject"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Medium / Blog</label>
                  <input
                    type="url"
                    value={formData.medium}
                    onChange={(e) => updateFormData('medium', e.target.value)}
                    placeholder="https://medium.com/@yourproject"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">YouTube</label>
                  <input
                    type="url"
                    value={formData.youtube}
                    onChange={(e) => updateFormData('youtube', e.target.value)}
                    placeholder="https://youtube.com/@yourproject"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Facebook</label>
                  <input
                    type="url"
                    value={formData.facebook}
                    onChange={(e) => updateFormData('facebook', e.target.value)}
                    placeholder="https://facebook.com/yourproject"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">TikTok</label>
                  <input
                    type="url"
                    value={formData.tiktok}
                    onChange={(e) => updateFormData('tiktok', e.target.value)}
                    placeholder="https://tiktok.com/@yourproject"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Instagram</label>
                  <input
                    type="url"
                    value={formData.instagram}
                    onChange={(e) => updateFormData('instagram', e.target.value)}
                    placeholder="https://instagram.com/yourproject"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              <h3 className="text-lg font-semibold pt-4 border-t border-gray-700">Code Repository <span className="text-gray-500 text-sm font-normal">(optional)</span></h3>

              <div>
                <label className="block text-sm text-gray-400 mb-2">GitHub</label>
                <input
                  type="url"
                  value={formData.github}
                  onChange={(e) => updateFormData('github', e.target.value)}
                  placeholder="https://github.com/yourproject"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-2">
                  A public GitHub repository improves your project&apos;s trust score. Private repos or other source control systems are accepted but will count less until independently verified.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Team */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Team Information</h2>
              <p className="text-gray-400 text-sm">Add team members - all fields are optional</p>

              {teamMembers.map((member, index) => (
                <div key={index} className="p-4 bg-gray-700 rounded-lg space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Team Member #{index + 1}</span>
                    {teamMembers.length > 1 && (
                      <button
                        onClick={() => removeTeamMember(index)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Full Name</label>
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => updateTeamMember(index, 'name', e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 focus:border-yellow-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Position / Role</label>
                      <input
                        type="text"
                        value={member.role}
                        onChange={(e) => updateTeamMember(index, 'role', e.target.value)}
                        placeholder="e.g., CEO, CTO, Lead Developer"
                        className="w-full bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 focus:border-yellow-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Short Bio</label>
                    <textarea
                      value={member.bio}
                      onChange={(e) => updateTeamMember(index, 'bio', e.target.value)}
                      placeholder="Brief background and experience..."
                      rows={2}
                      className="w-full bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 focus:border-yellow-500 focus:outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Photo URL</label>
                    <input
                      type="url"
                      value={member.photoUrl}
                      onChange={(e) => updateTeamMember(index, 'photoUrl', e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      className="w-full bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 focus:border-yellow-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">LinkedIn</label>
                      <input
                        type="url"
                        value={member.linkedin}
                        onChange={(e) => updateTeamMember(index, 'linkedin', e.target.value)}
                        placeholder="https://linkedin.com/in/..."
                        className="w-full bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 focus:border-yellow-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Twitter / X</label>
                      <input
                        type="url"
                        value={member.twitter}
                        onChange={(e) => updateTeamMember(index, 'twitter', e.target.value)}
                        placeholder="https://twitter.com/..."
                        className="w-full bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 focus:border-yellow-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addTeamMember}
                className="w-full py-3 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-yellow-500 hover:text-yellow-500 transition-colors flex items-center justify-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span>Add Team Member</span>
              </button>
            </div>
          )}

          {/* Step 5: Payment */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Listing Options</h2>
              <p className="text-gray-400 text-sm">Choose how you want your project listed</p>

              {/* Testnet Banner */}
              {isTestnet && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/50 rounded-lg">
                  <p className="text-sm text-purple-400 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    You&apos;re on Base Sepolia testnet. Use testnet USDC for premium listings.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {/* Free Listing */}
                <div
                  onClick={() => !submitted && updateFormData('listingType', 'free')}
                  className={`p-6 rounded-lg cursor-pointer border-2 transition-all ${
                    formData.listingType === 'free'
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : 'border-gray-600 hover:border-gray-500'
                  } ${submitted ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-lg mb-1">Free Listing</div>
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="text-2xl text-green-400">$0</span>
                      </div>
                      <ul className="text-sm text-gray-400 space-y-2">
                        <li className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                          Listed in the directory
                        </li>
                        <li className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                          Community voting enabled
                        </li>
                        <li className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                          Comments and feedback
                        </li>
                        <li className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                          Position based on community score
                        </li>
                      </ul>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      formData.listingType === 'free' ? 'border-yellow-500 bg-yellow-500' : 'border-gray-500'
                    }`}>
                      {formData.listingType === 'free' && <Check className="h-4 w-4 text-black" />}
                    </div>
                  </div>
                </div>

                {/* Premium Listing - Coming Soon */}
                <div
                  className="p-6 rounded-lg border-2 border-gray-700 relative overflow-hidden opacity-60 cursor-not-allowed"
                >
                  {/* Coming Soon Overlay */}
                  <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-10">
                    <div className="bg-gray-800 px-4 py-2 rounded-full flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <span className="text-yellow-500 font-medium">Coming Soon</span>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 bg-gray-600 text-gray-400 text-xs font-bold px-3 py-1 rounded-bl-lg">
                    FEATURED
                  </div>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-lg mb-1 flex items-center text-gray-500">
                        <Crown className="h-5 w-5 text-gray-500 mr-2" />
                        Premium Listing
                      </div>
                      <div className="text-2xl text-gray-500 mb-3">{formattedPrice} USDC</div>
                      <ul className="text-sm text-gray-500 space-y-2">
                        <li className="flex items-center">
                          <Check className="h-4 w-4 text-gray-600 mr-2 flex-shrink-0" />
                          Everything in Free
                        </li>
                        <li className="flex items-center">
                          <Check className="h-4 w-4 text-gray-600 mr-2 flex-shrink-0" />
                          Featured at top of listings for 7 days
                        </li>
                        <li className="flex items-center">
                          <Check className="h-4 w-4 text-gray-600 mr-2 flex-shrink-0" />
                          Premium badge on your listing
                        </li>
                        <li className="flex items-center">
                          <Check className="h-4 w-4 text-gray-600 mr-2 flex-shrink-0" />
                          Priority review and approval
                        </li>
                      </ul>
                    </div>
                    <div className="w-6 h-6 rounded-full border-2 border-gray-600" />
                  </div>
                </div>
              </div>

              {/* Premium Payment Section */}
              {formData.listingType === 'premium' && !submitted && (
                <div className="space-y-4 pt-4 border-t border-gray-700">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Payment Details</h3>
                    <span className="text-sm text-gray-400">
                      Balance: <span className="text-white font-mono">{formattedBalance} USDC</span>
                    </span>
                  </div>

                  {/* Payment Status */}
                  {paymentError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                      <p className="text-sm text-red-400">{paymentError}</p>
                    </div>
                  )}

                  {paymentStatus === 'confirming' && (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
                        <div>
                          <p className="font-medium text-yellow-500">Confirming transaction...</p>
                          {txHash && (
                            <a
                              href={`https://sepolia.basescan.org/tx/${txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-gray-400 hover:text-yellow-500 flex items-center mt-1"
                            >
                              View on BaseScan <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {isConfirmed && (
                    <div className="p-4 bg-green-500/10 border border-green-500/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Check className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium text-green-500">Payment confirmed!</p>
                          {txHash && (
                            <a
                              href={`https://sepolia.basescan.org/tx/${txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-gray-400 hover:text-green-500 flex items-center mt-1"
                            >
                              View on BaseScan <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Success Message */}
              {submitted && (
                <div className="p-6 bg-green-500/10 border border-green-500/50 rounded-lg text-center">
                  <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-green-500 mb-2">Project Submitted!</h3>
                  <p className="text-gray-400">
                    Your project has been submitted and will appear in the directory.
                  </p>
                </div>
              )}

              <div className="p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-400">How it works</p>
                    <p className="text-gray-400 mt-1">
                      {formData.listingType === 'free'
                        ? 'Your project will be listed and the community will vote on it. Projects rise or fall based on their community score.'
                        : 'Pay with USDC to get your project featured at the top for 7 days. After that, position is determined by community score.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-700">
            <button
              onClick={prevStep}
              disabled={currentStep === 1 || submitting || submitted}
              className="flex items-center space-x-2 px-6 py-3 border border-gray-600 rounded-lg hover:border-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
              <span>Back</span>
            </button>

            {currentStep < 5 ? (
              <div className="flex items-center space-x-3">
                {/* Skip button for optional steps (2, 4) — step 3 requires a social link */}
                {(currentStep === 2 || currentStep === 4) && (
                  <button
                    onClick={nextStep}
                    className="flex items-center space-x-2 px-6 py-3 border border-gray-600 text-gray-400 rounded-lg hover:border-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <SkipForward className="h-4 w-4" />
                    <span>Skip</span>
                  </button>
                )}
                <button
                  onClick={nextStep}
                  disabled={!isStepValid()}
                  className="flex items-center space-x-2 px-6 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span>Continue</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            ) : submitted ? (
              <a
                href="/projects"
                className="flex items-center space-x-2 px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-400 transition-colors"
              >
                <span>View Projects</span>
                <ChevronRight className="h-5 w-5" />
              </a>
            ) : (
              <button
                onClick={async () => {
                  if (formData.listingType === 'premium') {
                    setSubmitting(true);
                    const success = await payForPremium();
                    if (success) {
                      // Wait for confirmation effect to trigger
                      // The isConfirmed state will update and show success
                    }
                    setSubmitting(false);
                  } else {
                    // Free listing - just submit
                    setSubmitting(true);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    setSubmitted(true);
                    setSubmitting(false);
                  }
                }}
                disabled={submitting || (formData.listingType === 'premium' && isConfirming)}
                className="flex items-center space-x-2 px-6 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting || isConfirming ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{isConfirming ? 'Confirming...' : 'Processing...'}</span>
                  </>
                ) : (
                  <span>{formData.listingType === 'free' ? 'Submit Project' : `Pay ${formattedPrice} USDC & Submit`}</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
